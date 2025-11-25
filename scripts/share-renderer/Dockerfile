FROM mcr.microsoft.com/playwright:v1.48.2-jammy

WORKDIR /app
# If package-lock.json is not present (repo keeps only package.json), fall back to npm install.
COPY package.json ./
RUN npm install --production
COPY server.js .

ENV PORT=4000
EXPOSE 4000
CMD ["npm", "start"]
