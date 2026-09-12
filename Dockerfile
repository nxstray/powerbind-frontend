# ── Stage 1: build static assets pakai Vite ──────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
# --legacy-peer-deps: proyek ini pakai kombinasi versi bleeding-edge
# (Vite 8, Tailwind v4, ESLint 10) yang peer-dependency-nya belum semua rapi.
RUN npm install --legacy-peer-deps

COPY . .
ARG VITE_API_URL=http://localhost:8045
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ── Stage 2: serve hasil build lewat nginx ───────────────────────────────
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
