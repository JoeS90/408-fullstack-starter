# Deploying with Docker

This directory contains instructions and scripts for deploying the Node.js
application to an AWS EC2 instance using Docker containers. This method
simplifies the deployment process by encapsulating the application and its
dependencies within Docker containers, making it easier to manage and scale.

The deployment process uses the `dev.sh` script to automate common tasks such as
building Docker images, pushing them to Docker Hub, and deploying them to the EC2
instance.

## Prerequisites

Before you begin, ensure complete the following steps:

- [Install Docker](https://docs.docker.com/get-docker/)
- Create a free account on [Docker Hub](https://hub.docker.com/)
- Create a Docker Hub [Personal Access Token](https://docs.docker.com/docker-hub/access-tokens/)

## Step 1: Ensure Your EC2 running

You should have received an email from your instructor with a link to a Google
Drive folder containing instructions. Follow those instructions to ensure your
EC2 instance is running and accessible with the provided bash script.

## Step 2: Create a new .env File

Before you configure your project make sure you have following:

- Your Docker Hub username
- Your Docker Hub Personal Access Token
- Your AWS EC2 **Public DNS** which you can find in the instructions emailed to you.

>[!WARNING]
>Do not commit your `.env` file to version control, or any `.pem` files containing your SSH keys. These files contain sensitive information that should not be shared publicly. If you accidentally commit these files, email your instructor immediately so they can be revoked and replaced.

Create a new configuration:
```bash
./dev.sh new
```

Initialize your project:
```bash
./dev.sh init
```

## Step 3: Validate your Configuration

Run the following command to validate your configuration:
```bash
./dev.sh login
```

If the validation is successful, you should see something like this:

```
✔ .env file found.
Authenticating Docker Hub credentials...
✔ Docker Hub authentication successful.
Validating EC2 connection...
✔ EC2 connection successful.
Checking other environment variables...
APP_NAME: full-stack-web-app
APP_VERSION: latest
EC2_DEPLOY_DIR: /home/ubuntu/full-stack-web-app
✔ All required environment variables are set.
```
If there are any issues with your configuration, the output will indicate what
needs to be fixed.

## Step 4: Run the Application

Make sure your project builds and runs locally before deploying to production.
Start the Docker Compose services in production mode:

```bash
./dev.sh up
```

You should see output indicating that the services are starting up. Test the
application locally by navigating to the URL that was output in your terminal,
and ensure everything is working as expected. Make sure to test any database
functionality as well.

## Step 5: Build Docker Images and Push to Docker Hub

Once you have confirmed that the application is working correctly locally, build and
push the Docker images to Docker Hub:

```bash
./dev.sh build
./dev.sh push
```

## Step 6: Deploy to AWS EC2

Finally, deploy the application to your AWS EC2 instance:

```bash
./dev.sh deploy
```
You should see output indicating that the deployment is in progress. Once the
deployment is complete, you can access your application using the Public DNS of
your EC2 instance in your web browser.

## Viewing Logs

To view real-time logs from your EC2 instance:

```bash
./dev.sh logs
```

You should see the logs from your Docker containers streaming in your terminal.
This is useful for monitoring the application and debugging any issues that may
arise.

## SSH into your EC2 Instance

To SSH into your EC2 instance, use the following command:

```bash
./dev.sh ssh
```