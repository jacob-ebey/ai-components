# Remix AI Template!

<img width="1420" alt="image" src="https://github.com/jacob-ebey/ai-components/assets/12063586/a29ee17a-5270-4ccc-95ad-514b5afdefcc">

- [Remix Docs](https://remix.run/docs)

## Development

Create a `.env` file with the following contents:

```sh
SESSION_SECRET="super-duper-secret"
```

From your terminal:

```sh
npm run dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

Now you'll need to pick a host to deploy it to.

### DIY

If you're familiar with deploying node applications, the built-in Remix app server is production-ready.

Make sure to deploy the output of `remix build`

- `build/`
- `public/build/`
