FROM node:20-alpine AS downloader
WORKDIR /tmp
RUN apk add --no-cache wget && \
    wget -q "https://unpkg.com/react@18.3.1/umd/react.production.min.js" -O react.min.js && \
    wget -q "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" -O react-dom.min.js

FROM nginx:1.27-alpine
COPY --from=downloader /tmp/react.min.js /usr/share/nginx/html/react.min.js
COPY --from=downloader /tmp/react-dom.min.js /usr/share/nginx/html/react-dom.min.js
COPY app/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
