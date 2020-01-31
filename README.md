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
2. Edit the `docker-compose.env` file to provide your credentials for services used
3. Add your Google credentials JSON as `gsc_creds.json` here
4. Clone the individual repositories needed from the gitlab project `https://gitlab.com/videowiki`
- backend
- frontend
- audio_processor
- exporter
- spleeter
- translator
- transcriber
5. `cd` into each of the above and run `npm install`
6. Copy gsc_creds.json in both `translator` and `transcriber` directories
7. Go to the parent directory `videowiki`
8. Start the application with `docker-compose up`
9. Navigate to `tvw.localhost` to access the application

## Current Architecture
![Current Architecture](Current_Architecture.jpg)

## Current Workflow
![Workflow](Workflow.png)

## Upcoming Architecture
![Upcoming Architecture](Upcoming_Architecture.jpg)
