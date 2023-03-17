FROM node:16

# Update aptitude with new repo
RUN apt-get update

# Install software
RUN apt-get install -y git libvips-dev

# Make ssh dir
RUN mkdir /root/.ssh/



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
