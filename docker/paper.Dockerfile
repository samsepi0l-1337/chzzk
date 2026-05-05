FROM eclipse-temurin:21-jdk AS plugin-build

WORKDIR /workspace
RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip \
    && rm -rf /var/lib/apt/lists/*
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY plugin ./plugin
RUN ./gradlew --no-daemon :plugin:shadowJar

FROM eclipse-temurin:21-jre

ARG PAPER_VERSION=1.21.8
ARG PAPER_BUILD=60

WORKDIR /server

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL \
    "https://api.papermc.io/v2/projects/paper/versions/${PAPER_VERSION}/builds/${PAPER_BUILD}/downloads/paper-${PAPER_VERSION}-${PAPER_BUILD}.jar" \
    -o /opt/paper.jar

COPY --from=plugin-build /workspace/plugin/build/libs/chzzk-donation-0.1.0.jar /opt/chzzk-donation.jar
COPY docker/paper-entrypoint.sh /usr/local/bin/paper-entrypoint.sh

RUN chmod +x /usr/local/bin/paper-entrypoint.sh

EXPOSE 25565 29371

ENTRYPOINT ["paper-entrypoint.sh"]
CMD ["java", "-Xms1G", "-Xmx1G", "-jar", "/opt/paper.jar", "--nogui"]
