
microexpression-js
===

Openvidu js: [docs.openvidu.io/en/stable/advanced-features/filters](http://docs.openvidu.io/en/stable/advanced-features/filters/)

microexpression library: [face-api.js](https://github.com/justadudewhohacks/face-api.js/)

## Run this application

```bash
docker run -p 4443:4443 --rm -e openvidu.secret=MY_SECRET DOMAIN_OR_PUBLIC_IP=192.168.0.219 openvidu/openvidu-server-kms:2.15.0

http-server web -S -C cert.pem
```

You will need `http-server` npm package (`sudo npm install -g http-server`), and you will need to accept the insecure certificate at [https://localhost:4443](https://localhost:4443) once you launch openvidu-server-kms docker container.
