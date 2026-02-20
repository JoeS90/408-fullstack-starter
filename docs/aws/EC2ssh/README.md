# SSH into your EC2 Instance

## Find your EC2 instance that you created.

![1](image01.png)

---

![2](image02.png)

## Get the connection info for your EC2 instance

![3](image03.png)
## SSH Connection

![4](image04.png)

## Public IP Address

![5](image05.png)
## SSH into your EC2 instance

* Open up a terminal and set the correct permissions on your key.
  * chmod 400 ssh-yourname-key.pem
* Now ssh with the command you copied in the steps above
* Run uname \-a to confirm you are logged into your server

![6](image06.png)

## Troubleshooting

If you see the error below you did not set the correct permissions on your key. Go back and read the previous section and follow each step carefully.

![7](image07.png)