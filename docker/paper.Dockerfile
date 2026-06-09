FROM eclipse-temurin:21-jre

ARG PAPER_VERSION=1.21.1
ARG PAPER_BUILD=133

WORKDIR /server

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL \
    "https://api.papermc.io/v2/projects/paper/versions/${PAPER_VERSION}/builds/${PAPER_BUILD}/downloads/paper-${PAPER_VERSION}-${PAPER_BUILD}.jar" \
    -o /opt/paper.jar

COPY artifacts/chzzk-donation.jar /opt/chzzk-donation.jar
COPY docker/paper-entrypoint.sh /usr/local/bin/paper-entrypoint.sh

RUN chmod +x /usr/local/bin/paper-entrypoint.sh

EXPOSE 25565

ENTRYPOINT ["paper-entrypoint.sh"]
CMD ["java", "-Xms1G", "-Xmx1G", "-jar", "/opt/paper.jar", "--nogui"]
