FROM alpine:3.20

ENV JMETER_SHA512=5978a1a35edb5a7d428e270564ff49d2b1b257a65e17a759d259a9283fc17093e522fe46f474a043864aea6910683486340706d745fcdf3db1505fd71e689083
# Install Java, curl, unzip, ca-certs, and update OpenSSL to fix CVE-2025-9232
RUN apk update && apk upgrade --no-cache openssl && \
    apk add --no-cache \
    openjdk11 \
    curl \
    unzip \
    ca-certificates && \
    update-ca-certificates
# Download and install JMeter
RUN wget -c https://dlcdn.apache.org//jmeter/binaries/apache-jmeter-5.6.3.tgz && \
    echo "$JMETER_SHA512  ./apache-jmeter-5.6.3.tgz" | sha512sum -c - && \
    tar -xf apache-jmeter-5.6.3.tgz -C /opt && \
    rm apache-jmeter-5.6.3.tgz

# Set environment variables for JMeter
ENV JMETER_HOME=/opt/apache-jmeter-5.6.3
ENV PATH="$PATH:$JMETER_HOME/bin"

# Install AWS CLI v2
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --no-cache-dir --break-system-packages awscli

# Set working directory
WORKDIR $JMETER_HOME/bin

# Copy test plan and entrypoint
COPY ./transactions-load-test.jmx ./plan.jmx
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Make entrypoint executable
RUN chmod +x ./docker-entrypoint.sh
ENTRYPOINT ["sh","-c","./docker-entrypoint.sh"]
