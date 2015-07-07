FROM ubuntu:latest
COPY . /src
RUN apt-get update
RUN apt-get install -y nodejs npm
RUN cd /src; npm install
ENV ES
CMD node /src/fetchMarketCap.js > /log.log