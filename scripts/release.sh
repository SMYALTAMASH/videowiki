export BASE_REPO=$1
export SERVICE_NAMESPACE=$2
export AWS_SERVICE_NAME=$3
export RELEASE_VERSION_NUMBER=$4

if ["$1" = ""]; then
        echo "Usage: source build.sh docker-repo service-namespace service-name"
        exit 1
else
        echo "Building image..."
        docker build \
                -f Dockerfile \
                -t $BASE_REPO/$SERVICE_NAMESPACE/$AWS_SERVICE_NAME:${CI_COMMIT_SHA} \
                -t $BASE_REPO/$SERVICE_NAMESPACE/$AWS_SERVICE_NAME:master \
                .

        echo "PUSHING IMAGE"
        echo "REPO NAME = " + $BASE_REPO/$SERVICE_NAMESPACE/$AWS_SERVICE_NAME
        # Install AWS CLI
        echo " INSTALLING AWS CLI "
        apk add --update python python-dev py-pip jq
        pip install awscli --upgrade

        echo "CONFIGURING AWS"
        # Configure AWS Access Key ID
        aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID --profile default

        # Configure AWS Secret Access Key
        aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY --profile default

        # Configure AWS default region
        aws configure set region $AWS_DEFAULT_REGION --profile default

        echo "LOGGING IN AWS ECR"
        # Log into Amazon ECR
        # aws ecr get-login returns a login command w/ a temp token
        LOGIN_COMMAND=$(aws ecr get-login --no-include-email --region $AWS_DEFAULT_REGION)

        # save it to an env var & use that env var to login
        $LOGIN_COMMAND
        echo " Pulling image " + $BASE_REPO/$SERVICE_NAMESPACE/$AWS_SERVICE_NAME:master
        docker pull $BASE_REPO/$SERVICE_NAMESPACE/$AWS_SERVICE_NAME:${CI_COMMIT_SHA}
        docker tag  $BASE_REPO/$SERVICE_NAMESPACE/$AWS_SERVICE_NAME:${CI_COMMIT_SHA} $CI_REGISTRY/$SERVICE_NAMESPACE/$AWS_SERVICE_NAME:$VERSION_NUMBER
        # LOGIN TO GITLAB REGISTERY
        docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
        docker push $CI_REGISTRY/$SERVICE_NAMESPACE/$AWS_SERVICE_NAME:$RELEASE_VERSION_NUMBER

fi
#         -t $CI_REGISTRY_IMAGE:$CI_COMMIT_REF_NAME \
#         .
# docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_REF_NAME