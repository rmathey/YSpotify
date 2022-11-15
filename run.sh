#!/bin/bash

# This script is used to run the application with Docker

# Build the image
docker build -t ynov-tp-oauth .

# Run the container
docker run -p 3000:3000 ynov-tp-oauth
