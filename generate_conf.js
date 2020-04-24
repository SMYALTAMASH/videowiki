const fs = require('fs');
const DOCKER_REPO_ROOT = 'example.dkr.ecr.eu-west-1.amazonaws.com/videowiki';

const path = require('path');
const VENDORS_OUT_DIR_PATH = path.join(__dirname, 'meta');
const stages = ['dev', 'prod'];
if (!fs.existsSync(VENDORS_OUT_DIR_PATH)) {
    fs.mkdirSync(VENDORS_OUT_DIR_PATH);
}

stages.forEach((stage) => {
    if (!fs.existsSync(stage)) {
        fs.mkdirSync(stage)
    }
})

function generateApiServiceDeployment({ serviceName, imageName, containerPort, replicas, cpu, loadbalancer, stickySession, stage }) {
    return `
apiVersion: apps/v1
kind: Deployment
metadata:
    name: ${serviceName}-deployment
spec:
    replicas: ${replicas}
    selector:
        matchLabels:
            component: ${serviceName}
    template:
        metadata:
            labels:
                component: ${serviceName}
                stage: ${stage}
        spec:
            containers:
            - name: ${serviceName}
              imagePullPolicy: Always
              image: ${imageName}
              ports:
                - containerPort: ${containerPort}
              envFrom:
                - secretRef:
                    name: videowikisecretkeys
---

apiVersion: v1
kind: Service
metadata:
    name: ${serviceName}-cluster-ip
    # namespace: videowiki
${loadbalancer ? `
    annotations:
        service.beta.kubernetes.io/aws-load-balancer-internal: "true"
` : ''}        
spec:
    type: ${loadbalancer ? 'LoadBalancer' : 'ClusterIP'}
    selector:
        component: ${serviceName}
    ports:
    - port: ${containerPort}
      targetPort: ${containerPort}    
${stickySession ? `
    sessionAffinity: ClientIP
` : ''}

`
}

function generateWorkerServiceDeployment({ serviceName, imageName, cpu, replicas, stage }) {
    return `
apiVersion: apps/v1
kind: Deployment
metadata:
    name: ${serviceName}-deployment
spec:
    replicas: ${replicas}
    selector:
        matchLabels:
            component: ${serviceName}
    template:
        metadata:
            labels:
                component: ${serviceName}
                stage: ${stage}
        spec:
            containers:
            - name: ${serviceName}
              imagePullPolicy: Always
              image: ${imageName}
              envFrom:
               - secretRef:
                    name: videowikisecretkeys

${cpu ? `
              resources:
                  requests:
                      cpu: ${cpu}

` : ''}
`

}

function generateSecretFile(data) {
    return `
apiVersion: v1
kind: Secret
metadata:
    name: videowikisecretkeys
    # namespace: videowiki

type: Opaque
data:
${['  '].concat(data).join('\n  ')}

`
}

function generateIngressService(routes, stage) {
    const prefix = stage === 'prod' ? 'alb' : 'nginx';
    return `
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
    name: ingress-service
    annotations:
        kubernetes.io/ingress.class: ${prefix}
        ${prefix}.ingress.kubernetes.io/proxy-body-size: 800m
        ${prefix}.ingress.kubernetes.io/enable-cors: "true"
        ${prefix}.ingress.kubernetes.io/cors-allow-headers: "DNT,Keep-Alive,User-Agent,With,If-Modified-Since,Cache-Control,Authorization,Content-type,Accept,X-Access-Token, vw-x-user-api-key, vw-x-user-api-key-secret, X-Vw-Anonymous-Id, X-Key, Cache-Control, X-Requested-With"
        ${prefix}.ingress.kubernetes.io/ssl-redirect: "${stage === 'prod' ? 'true' : 'false'}"
        ${prefix}.ingress.kubernetes.io/rewrite-target: /
        ${prefix}.ingress.kubernetes.io/scheme: internet-facing
        ${prefix}.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS":443}]'
        ${prefix}.ingress.kubernetes.io/actions.ssl-redirect: '{"Type": "redirect", "RedirectConfig": { "Protocol": "HTTPS", "Port": "443", "StatusCode": "HTTP_301"}}'
        ${prefix}.ingress.kubernetes.io/certificate-arn: ${stage === 'prod' ? 'arn:aws:acm:eu-west-1:677496996282:certificate/4b0f26c3-8beb-4efb-bd0b-5e2b44e37ab4' : 'arn:aws:acm:eu-west-1:677496996282:certificate/4af85657-8d02-4d3b-b489-f1dcd0ae5408'}
        albs.ingress.kubernetes.io/websocket-services: websockets-service-cluster-ip
        albs.org/websocket-services: websockets-service-cluster-ip
        albs.ingress.kubernetes.io/proxy-read-timeout: "1800"
        albs.ingress.kubernetes.io/proxy-send-timeout: "1800"
        ${prefix}.ingress.kubernetes.io/load-balancer-attributes: idle_timeout.timeout_seconds=600
        ${prefix}.ingress.kubernetes.io/target-type: ip
        service.beta.kubernetes.io/aws-load-balancer-backend-protocol: "tcp" 
spec:
    rules:
    - http:
        paths:
${stage === 'prod' ? `
            - path: /*
              backend:
                serviceName: ssl-redirect
                servicePort: use-annotation
` : ''}
${routes.map(r => `
            - path: ${r.path}
              backend:
                serviceName: ${r.serviceName}
                servicePort: ${r.servicePort}
`).join('\n')}   
`
}

function generateSkaffoldFile({ deployments, manifests }) {
    return `
apiVersion: skaffold/v1beta2
kind: Config

build:
    local:
      push: false
    artifacts:
${deployments.map(d => `
      - image: ${d.image}
        context: ${d.name} # FOLDER THAT HAVE Dockerfile
        docker:
          dockerfile: Dockerfile.dev
        sync:
          '**/*.js': .
          '**/*.css': .
          '**/*.scss': .
          '**/*.html': .`).join('')}
deploy:
    kubectl:
      manifests:
${manifests.map(m => `
        - ${m}`).join('')}
`
}

function generateDockerComposeFile({ services }) { 
    return `
version: '3'
# DEV DOCKER COMPOSE
services:
### DEPENDENCIES ###
    redis-server:
        image: redis
########################################################################################
    mongo-server:
        image: mongo:4.0.10
        restart: on-failure
        # environment:
        #   - MONGO_INITDB_ROOT_USERNAME=root
        #   - MONGO_INITDB_ROOT_PASSWORD=root
        #   - MONGO_INITDB_DATABASE=tailored_videowiki
        volumes:
        - ./data:/data/db
        - ./data:/var/lib/mongodb 
########################################################################################
    rabbitmq-server:
        image: rabbitmq
        restart: on-failure
########################################################################################
    nginx_server:
        image: nginx:1.14.0
        restart: on-failure
        ports:
            - 80:80
        volumes:
        - ./nginx_config:/etc/nginx/conf.d

########################################################################################
    client:
        build:
            context: ./client
            dockerfile: Dockerfile.dev
        volumes:
            - ./client:/client
            - /client/node_modules
        ports:
            - 3000:3000
########################################################################################
    api-gateway-service:
        restart: on-failure
        env_file:
            - docker-compose.env
        build:
            context: ./api-gateway-service
            dockerfile: Dockerfile.dev

        depends_on:
            - redis-server
            - mongo-server
            - rabbitmq-server
        volumes:
            - ./api-gateway-service:/api-gateway-service
        ports:
            - 4000:4000
        command: ['./wait-for-it.sh', 'rabbitmq-server:5672', '-s', '-t', '15', '--', 'npm', 'run', 'dev']
    websockets-service:
        restart: on-failure
        env_file:
            - docker-compose.env
        build:
            context: ./websockets-service
            dockerfile: Dockerfile.dev
        volumes:
            - ./websockets-service:/websockets-service
        ports:
            - 4010:4000
        command: ['./wait-for-it.sh', 'rabbitmq-server:5672', '-s', '-t', '15', '--', 'npm', 'run', 'dev']

${services.map(s => `
    ${s}:
        env_file:
            - docker-compose.env
        build:
            context: ./${s}
            dockerfile: Dockerfile.dev
        volumes:
            - ./${s}:/${s}
            - /${s}/node_modules
        command: ['./wait-for-it.sh', 'rabbitmq-server:5672', '-s', '-t', '15', '--', 'npm', 'run', 'docker:dev']
`).join('')}
    
`
}

const deployments = [
    // SERVICES
    {
        name: 'redis',
        image: 'redis:5.0.8',
        containerPort: 6379,
        type: 'vendor',
        replicas: 1,
    },
    {
        name: 'mongo',
        image: 'mongo:4.0.10',
        containerPort: 27017,
        type: 'vendor',
        replicas: 1,
    },
    {
        name: 'rabbitmq',
        image: 'rabbitmq:3.8.3',
        containerPort: 5672,
        type: 'vendor',
        replicas: 1,

    },
    // client
    {
        name: 'client',
        type: 'api',
        replicas: 1,
        containerPort: 3000,
        // loadbalancer: true,
    },
    // API's
    {
        name: 'api-gateway-service',
        type: 'api',
        replicas: 2,
        // loadbalancer: true,
    },
    {
        name: 'apikey-api-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'article-api-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'auth-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'comment-api-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'email-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'invitation-response-api-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'noise-cancellation-video-api-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'notification-api-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'organization-api-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'socket-connection-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'storage-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'subtitles-api-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'text-to-speech-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'translation-api-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'translation-export-api-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'user-api-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'video-api-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'video-tutorial-contribution-api-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'websockets-service',
        type: 'api',
        replicas: 2,
        // loadbalancer: true,
        stickySession: true,
    },
    {
        name: 'audio-processor-service',
        type: 'api',
        replicas: 2,
    },

    {
        name: 'translator-service',
        type: 'api',
        replicas: 2,
    },
    {
        name: 'noise-cancellation-api-service',
        type: 'api',
        replicas: 2,
    },
    // {
    //     name: 'whatsapp-bot',
    //     type: 'api',
    //     replicas: 1,
    // },
    // WORKERS
    {
        name: 'exporter-service',
        type: 'worker',
        cpu: 1,
        replicas: 1,
    },
    {
        name: 'bg-music-extractor-service',
        type: 'worker',
        replicas: 1,
        cpu: 2,
    },
    {
        name: 'transcriber-service',
        type: 'worker',
        replicas: 1
    },
    {
        name: 'video-noise-cancellation-service',
        type: 'worker',
        replicas: 1,
    }
];

function generateFileName(serviceName, serviceType) {
    if (serviceType === 'worker') return `${serviceName}-worker-deployment.yml`;
    if (serviceType === 'api') return `${serviceName}-api-deployment.yml`;
    if (serviceType === 'vendor') return `${serviceName}-vendor-deployment.yml`;
}

function init() {

    const filePaths = [];

    // GENERATE SECRETS
    const keyValues = [];
    fs.readFile('secrets.txt', (err, data) => {
        // console.log(err, )
        data.toString().split('\n').forEach((item) => {
            if (item && item.trim() && item.indexOf('#') !== 0) {
                const parts = item.trim().split('=')
                const key = parts[0];
                parts.shift();
                const value = parts.join('=');
                console.log(key, value)
                keyValues.push({ key, value });
            }
        })
        let finalData = []
        keyValues.forEach((keyVal) => {
            const encodedVal = new Buffer(keyVal.value).toString('base64');
            finalData.push(keyVal.key + ': ' + encodedVal.replace(/\n/g, ''));
        })
        // filePaths.push(path.join(__dirname, 'videowikisecretkeys_secret.yml'))
        fs.writeFileSync(path.join(__dirname, 'videowikisecretkeys_secret.yml'), generateSecretFile(finalData))

        // GENERATE INGRESS ROUTES
        const INGRESS_ROUTES = [
            {
                path: '/api*',
                serviceName: 'api-gateway-service-cluster-ip',
                servicePort: 4000,
            },
            {
                path: '/socket.io*',
                serviceName: 'websockets-service-cluster-ip',
                servicePort: 4000,
            },
            {
                path: '/*',
                serviceName: 'client-cluster-ip',
                servicePort: 3000,
            },
        ]
        filePaths.push(path.join(VENDORS_OUT_DIR_PATH, 'ingress-nginx.yml'))
        fs.writeFileSync(path.join(VENDORS_OUT_DIR_PATH, 'ingress-nginx.yml'), generateIngressService(INGRESS_ROUTES, 'dev'));
        fs.writeFileSync(path.join('prod', 'ingress-nginx.yml'), generateIngressService(INGRESS_ROUTES, 'prod'));
        const stages = ['dev', 'prod'];
        stages.forEach(stage => {
            // GENERATE DEPLOYMENTS
            if (!fs.existsSync(stage)) {
                fs.mkdirSync(stage);
            }
            deployments.forEach(({ name, image, type, replicas, cpu, containerPort, loadbalancer, stickySession }) => {
                let fileContent = '';
                if (!image && type !== 'vendor') {
                    image = `${DOCKER_REPO_ROOT}/${name}:master`
                }
                if (stage === 'dev') {
                    image = name
                }
                if (type === 'api') {
                    fileContent = generateApiServiceDeployment({ serviceName: name, imageName: image || name, containerPort: containerPort || 4000, replicas: replicas || 1, cpu: null, loadbalancer, stickySession, stage });
                } else if (type === 'worker') {
                    fileContent = generateWorkerServiceDeployment({ serviceName: name, imageName: image || name, replicas, cpu: null, stage });
                } else if (type === 'vendor') {
                    fileContent = generateApiServiceDeployment({ serviceName: name, imageName: image || name, containerPort: containerPort, replicas: 1, cpu: null });
                }
                // Dont add vendors to skaffold
                if (type !== 'vendor') {
                    filePaths.push(path.join(__dirname, stage, generateFileName(name, type)))
                }
                if (type === 'vendor') {
                    fs.writeFileSync(path.join(VENDORS_OUT_DIR_PATH, generateFileName(name, type)), fileContent);
                } else {
                    fs.writeFileSync(path.join(__dirname, stage, generateFileName(name, type)), fileContent);
                }
            })
        })

        // GENERATE SKAFFOLD FILE
        const manifests = filePaths.filter(d => d.indexOf('dev') !== -1);
        const skaffoldDeployments = deployments.filter(d => d.type !== 'vendor').map(d => {
            return {
                name: d.name,
                image: d.name,
            }
        })
        const skaffoldContent = generateSkaffoldFile({ deployments: skaffoldDeployments, manifests });
        console.log(skaffoldContent)
        fs.writeFileSync(path.join(__dirname,  'skaffold.yml'), skaffoldContent);

        // GENERATE DOCKER COMPOSE FILE
        
        const composeServices = deployments.filter(d => d.type !== 'vendor' && d.name !== 'api-gateway-service' && d.name !== 'client' && d.name !== 'websockets-service' && d.name !== 'whatsapp-message-webhook')
        const dockerCompseContent = generateDockerComposeFile({ services: composeServices.map(s => s.name) });
        fs.writeFileSync(path.join(__dirname, 'docker-compose.yml'), dockerCompseContent);

        console.log('compose services', dockerCompseContent)
    })

}


init()