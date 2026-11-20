# Đảo Đèn Lồng — chạy bằng Docker (macOS/Linux)
#
#   docker build -t dao-den-long .
#   docker run --rm -p 8080:8080 dao-den-long
#
# GUI:            http://localhost:8080
# Headless:
#   docker run --rm -v "$PWD/out:/out" dao-den-long \
#     node dist/headless.js --seed 1 --night 1 --ticks 600 --out /out/run.jsonl

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/game.contract.json ./game.contract.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

EXPOSE 8080

# GUI: serve thu muc web tinh bang http-server nho (khong can them phu thuoc).
RUN npm i -g http-server@14
CMD ["http-server", "dist/web", "-p", "8080", "-c-1"]
