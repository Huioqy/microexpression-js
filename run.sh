
docker run -p 4443:4443 --rm -e DOMAIN_OR_PUBLIC_IP=192.168.0.219 openvidu/openvidu-server-kms:2.15.0

http-server web -S -C cert.pem
