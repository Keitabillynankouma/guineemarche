FROM node:20-alpine AS build
WORKDIR /app

# Build args (variables disponibles au moment du build Vite)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Installer les dépendances
COPY package.json ./
RUN npm install

# Copier le code source
COPY . .

# Builder l'app Vite (VITE_API_URL est injecté dans le bundle)
RUN npm run build

# Stage final : serveur léger pour les fichiers statiques
FROM node:20-alpine AS runtime
WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist ./dist

CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
