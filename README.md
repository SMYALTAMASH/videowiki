Please follow this guide to set up Videowiki locally.

## Pre-requisites:
Videowiki uses the following services. To set it up successfully please ensure
that you have working accounts for these.
- Google Cloud (for Translation and Text-to-Speech)
- AWS (for Transcription, Storage and Text-to-Sppech)
- Babble Labs (for Background Noise Cancellation)
- Mailgun (for Emails)

## Steps
1. Clone this repository
2. `cd videowiki`
3. Add your Google credentials JSON as `gsc_creds.json` here
4. Clone the individual repositories needed from the gitlab project `https://gitlab.com/videowiki`
- client
- api-gateway-service
- websockets-service
- apikey-api-service
- article-api-service
- auth-service
- comment-api-service
- email-service
- invitation-response-api-service
- noise-cancellation-video-api-service
- notification-api-service
- organization-api-service
- socket-connection-service
- storage-service
- subtitles-api-service
- text-to-speech-service
- translation-api-service
- translation-export-api-service
- user-api-service
- video-api-service
- video-tutorial-contribution-api-service
- audio-processor-service
- translator-service
- noise-cancellation-api-service
- exporter-service
- bg-music-extractor-service
- transcriber-service
- video-noise-cancellation-service

5. `cd` into each of the above and run `npm install`
6. Copy gsc_creds.json in both `translator-service` and `text-to-speech-service` directories
7. Go to the parent directory `videowiki`

### For docker-compose deployments
1. edit `docker-compose.env` to provide your credentials for services used.
2. run `node generate_conf.js` to generate the docker-compose.yml file, and kube config files ( in a subdirectory `prod`)
3. Start the application with `docker-compose up`
4. Navigate to `tvw.localhost` to access the application

### For kuberenetes deployments
1. edit `secrets.txt` to provide your credentials for services used.
2. run `node generate_conf.js` to generate the docker-compose.yml file, and kube config files ( in a subdirectory `prod`)
3. run `node generate_secrets.js` to generate the secrets file ( which encodes the secrets in secrets.txt to base64 formats compatible with kube secrets )
4. a new file will be generated named `videowikisecretkeys_secret.yml` that contains the encoded secrets file
5. apply the secrets file to your kube cluster `kubectl apply -f videowikisecretkeys_secret.yml`
6. apply the redis and rabbitmq deployments from the `meta/` directory
7. for local deployments, you can apply the generated mongo deployment in the `meta` directory, for production deployments IT'S NECESSARY to either add persistent storage to the mongo deployment on the cluster or use a provider that can provide a provisioned mongo clusters 
8. apply the config files in the directory `prod/` to your cluster `kubectl apply -f prod/`

## notes on kubernetes deployments
1. We use AWS load balancer as our ingress provider to our cluster, please find the file `prod/ingress.nginx.yml` and change accordingly 
2. every generated config file contains a deployment definition and a ClusterIP service defenition behind which the deployment reside
3. To make a global update to the settings of the cluster ( number of replicas for example ). it's better to change that in the script `generate_conf.js` instead of manually changing in all generated 30+ files. this file should be always updated to manage the cluster deployments
4. we use AWS ECR to host our built containers from where kube can fetch them, please change the variable name `DOCKER_REPO_ROOT` in the `generate_config.js` file to reflect from where kube can get the containers
5. Skaffold can be used for local development on kubes, after running `node generate_conf.js` a file named `skaffold.yml` will be generated that can be used
## Components in videowiki and Scalability data: microservices available and its uses
components in videowiki and Scalability data: microservices available and its uses
 
### Stateless microservices used by VideoWiki:
1. nginx - used for routing the client request to app
2. client - renders the portal UI where videowiki operations can be performed
3. api-gateway-service - Entry point for requests coming from portal UI, routes the request to backend services. It performs authentication for token being passed in headers. It uses authentication service to check the token validity, stateless, Not much expected load
4. auth-service - creates and verifies the jwt keys for the users, used mainly for user login/register.
5. api-key-service: this creates the platform and service api keys, and also validates them, stateful set with common DB.
6. article service - its like an UI component used to render the broken slides in proofread stage. not much to care about scaling. depends on user load, its a stateful app with common mongo DB.
7. audio-processor-service - this processes the audio files performing noise cancellation, wrapper around babble labs.
8. bg-music-extractor - this takes video as input and extract background noise using ML, cpu intensive. At Least 2 cores for a single replica.
9. comment-api-service - handles comment for user interaction for converted slides mainly for review purpose.
10. email-service - uses mailgun to send emails for user activities, like reset password, login, register and stuff.
11. exporter-service - it splits the existing video in smaller chunks in the proofreading stage, so that the processing is faster and stitches them after the processing is done. min 2 cpu and 2GB RAM, CPU intensive
12. invitation-respose-api-service - handles user invitations, sends invitation token and URL for registration and has the state of invitation.
13. noise-cancellation-api-service - this is wrapper for audio-processor-service exposed like an api to public, we can control external vendors by creating subscriptions and service keys.
14. noise-cancellation-video-api-service - used to do noise cancellation on videos, by extracting the audio and sends the audio processor and puts back the audio again. 1CPU cores.
15. notification-api-service - used to send notifications for the user activities.
16. organization-api-service - used to handle organization related tasks. can invite users to org.
17. socket-connection-service - database wrapper for mongo model for the app.
18. websockets-service - handles the web socket connections for user, used to send the messages for stage completion. uses socket-connection service.
19. storage-service - s3 utility wrapper via api.
20. subtitles-api-service - responsible for subtitles manipulation after the transcribe stage. 
21. text-to-speech - used to convert text to speech and it uses both aws and GCP. is responsible for tts translation. no direct route to this service. less than 1CPU is also sufficient.
22. transcriber-service - used to transcribe a video, takes video and sends to transcribe. and puts the generated json in S3.
23. translation-api-service - used to perform translations by using article service
24. translation-export-apiservice - used to export the transported video from multiple chunks to single video, less than 1 CPU
26. translator service - wrapper around gcp translate to translate the text in real time
27. user-api-service - user related operations, like org details, new user creation.
28. video-api-service - uploading a new video, stage related info for videos.
29. video-noise-cancellation - extracts the audio from the video and sends to audio-noise cancellation service and receives the response and stitches it back.
20. videotutorialcontribution-service - used to have a faq on app usage.

### Stateful microservices:
1. Mongo DB - version [4.0.10],
    Supports cluster - master and slave possible.
    Scaling can be done easily by adding more read replicas [Horizontal Scaling].
2. Rabbit mq
    Transient data resides here
    messaging broker.
    scaling rabbit mq is not there.
    can we use kafka for messaging broker?
    Future plan is migrate to kafka
    Event Bus model

## Current Architecture
![Current Architecture](Upcoming_Architecture.jpg)


## Current Workflow
![Workflow](Workflow.png)

## Old Architecture
![Old Architecture](Current_Architecture.jpg)

## Code of Conduct
[Code of Conduct](Code_of_Conduct.docx)

## Harassment Complaint Form
[Harassment Complaint Form](https://docs.google.com/forms/d/e/1FAIpQLScMR9EqywvmTrxBiDc3QQG0E50XsnCU8LO7olFQ_7yFgy2Okg/viewform)

