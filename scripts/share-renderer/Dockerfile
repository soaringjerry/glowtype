FROM mcr.microsoft.com/playwright:v1.48.2-jammy

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY server.js .

ENV PORT=4000
EXPOSE 4000
CMD ["npm", "start"]
