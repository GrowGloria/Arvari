# Сборка и запуск бэкенда «Арвари» в контейнере.
# Двухэтапно: сначала компилируем SDK-образом, потом кладём результат в лёгкий
# рантайм-образ.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Arvari.Api.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .

# База и загрузки — на постоянный диск /data (примонтируйте том хостинга).
ENV ARVARI_DB=/data/arvari.db
ENV ARVARI_UPLOADS=/data/uploads
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "Arvari.Api.dll"]
