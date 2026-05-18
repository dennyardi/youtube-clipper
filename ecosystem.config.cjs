module.exports = {
  apps: [
    {
      name: "youtube-clipper-maker",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "900M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
