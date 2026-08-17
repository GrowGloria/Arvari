# Единый образ «Арвари»: собирает фронтенд и бэкенд и отдаёт их одним
# приложением. Контекст сборки — корень репозитория.

# 1) Сборка фронтенда (Vite). .env.production даёт VITE_API_URL=/api.
# Debian-slim (не alpine): нативный sharp ставится без плясок с musl.
FROM node:22-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2) Сборка бэкенда (ASP.NET Core).
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /src
COPY backend/Arvari.Api.csproj ./
RUN dotnet restore
COPY backend/ ./
RUN dotnet publish -c Release -o /out

# 3) Рантайм: бэкенд + собранный сайт в wwwroot.
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=backend /out ./
COPY --from=frontend /app/dist ./wwwroot

# База и картинки — на постоянный том /data.
ENV ARVARI_DB=/data/arvari.db
ENV ARVARI_UPLOADS=/data/uploads
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "Arvari.Api.dll"]
