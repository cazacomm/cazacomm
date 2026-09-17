# Site statique Caza Comm servi par nginx
FROM nginx:alpine

# Configuration du serveur
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Contenu du site (racine du repo)
COPY . /usr/share/nginx/html

# Fichiers d'infra qui n'ont rien a faire dans la racine servie
RUN rm -f /usr/share/nginx/html/Dockerfile \
          /usr/share/nginx/html/nginx.conf \
          /usr/share/nginx/html/.dockerignore

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
