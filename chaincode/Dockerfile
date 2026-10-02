FROM golang:1.25-alpine
ENV GOTOOLCHAIN=auto
WORKDIR /app
COPY . .
RUN go build -o /pulse .
EXPOSE 9999
CMD ["/pulse"]
