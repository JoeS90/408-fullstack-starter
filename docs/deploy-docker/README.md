# Deploying with Docker

This directory contains instructions and scripts for deploying the Node.js
application to an AWS EC2 instance using Docker containers. This method
simplifies the deployment process by encapsulating the application and its
dependencies within Docker containers, making it easier to manage and scale.

The deployment process uses the `dev.sh` script to automate common tasks such as
building Docker images, pushing them to Docker Hub, and deploying them to the EC2
instance.

## Step 1: SSH into your EC2 Instance

You should have received an email from your instructor with a link to a Google
Drive folder containing instructions. Follow those instructions to ssh into your VM.

## Step 2: Create a new .env File


>[!TIP]
>These instructions are for deploying directly from the EC2 instance. If you want to deploy from your local machine, follow the instructions in the [Deploying with Docker from Local Machine](../deploy-docker-remote/README.md) section instead. Accept the default options when prompted.

Create a new configuration:
```bash
./dev.sh new
```

## Step 3: Build and Install the Application on EC2

Build and install the application to your AWS EC2 instance:

```bash
./dev.sh build install
```
You should see output indicating that the deployment is in progress. Once the
deployment is complete, you can access your application using the Public DNS of
your EC2 instance in your web browser. After you make changes to the application
and want to deploy updates, simply run the same command again to rebuild and
redeploy the application.


## Viewing Logs

To view real-time logs from your EC2 instance:

```bash
docker compose logs -f
```

You should see the logs from your Docker containers streaming in your terminal.
This is useful for monitoring the application and debugging any issues that may
arise.