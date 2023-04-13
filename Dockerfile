# Use an official Node.js runtime as a parent image
FROM  node:6

# Set the working directory to /usr/src/app
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files to the container
COPY package*.json ./

# Install the dependencies
RUN npm install


# Copy the rest of the application code to the container
COPY . .

# Define the command to start the application
CMD ["node", "./src/index.js"]