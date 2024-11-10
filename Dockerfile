FROM node:18

# Update aptitude with new repo
RUN apt-get update

# Install software
RUN apt-get install -y git libvips-dev python3 build-essential

RUN ln -s /usr/bin/python3 /usr/bin/python && \
    rm -rf /var/lib/apt/lists/*

# Make ssh dir
RUN mkdir /root/.ssh/

# Set the PYTHON environment variable for node-gyp
ENV PYTHON=/usr/bin/python3
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1


# Upgrade npm and install node-gyp globally
RUN npm install -g npm@latest && \
    npm install -g node-gyp@latest


# Create known_hosts
RUN touch /root/.ssh/known_hosts
# Add bitbuckets key
RUN ssh-keyscan github.com >> /root/.ssh/known_hosts


WORKDIR /home/app/webapp

#RUN git clone https://github.com/extreme-coder/govsim-api.git

WORKDIR /home/app/webapp/gamebox-api

COPY . ./

RUN npm install

ENV NODE_ENV production

EXPOSE 1337

CMD ["npm", "run", "develop"]
