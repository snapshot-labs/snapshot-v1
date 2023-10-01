<div align="center">
    <img src="public/icon.svg" height="70" alt="Snapshot Logo">
    <h1>Snapshot</h1>
    <strong>Snapshot is an off-chain gasless multi-governance client with easy to verify and hard to contest results.</strong>
</div>
<br>
<div align="center">
    <a href="https://github.com/snapshot-labs/snapshot/actions/workflows/nodejs.yml">
        <img src="https://github.com/snapshot-labs/snapshot/actions/workflows/nodejs.yml/badge.svg" alt="Node CI">
    </a>
    <img src="https://img.shields.io/github/commit-activity/w/snapshot-labs/snapshot" alt="GitHub commit activity">
    <a href="https://github.com/snapshot-labs/snapshot/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22">
        <img src="https://img.shields.io/github/issues/snapshot-labs/snapshot/help wanted" alt="GitHub issues help wanted">
    </a>
    <a href="https://discord.snapshot.org/">
        <img src="https://img.shields.io/discord/707079246388133940.svg?label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2" alt="Discord">
    </a>
    <a href="https://twitter.com/SnapshotLabs">
        <img src="https://img.shields.io/twitter/follow/SnapshotLabs?label=SnapshotLabs&style=flat&logo=twitter&color=1DA1F2" alt="Twitter">
    </a>
</div>
<div align="center">
    <br>
    <a href="https://snapshot.org"><b>snapshot.org »</b></a>
    <br><br>
    <a href="https://docs.snapshot.org"><b>Documentation</b></a>
    •
    <a href="https://features.snapshot.org/feature-requests"><b>Feature requests</b></a>
    •
    <a href="https://docs.snapshot.org/guides/contribute"><b>Contribute</b></a>
</div>

## Introduction
Welcome to Snapshot!

Snapshot is your ticket to simple and affordable on-chain voting for DAOs. This framework empowers DAOs to conduct on-chain governance efficiently and affordably. Built on StarkNet, it facilitates governing your community. 
In this documentation, we'll guide you through Snapshot step by step. Whether you're new to DAOs or a seasoned pro, you'll find everything you need to know to get started and make the most user-friendly tool for your governance needs. 
For more in-depth information, please refer to [this link](https://snapshot.mirror.xyz/cUOrwdtEs5PvNh0sqYWWxPjt8GdJWn_Qp3cl7E3_8IU) 

## Project setup

Open your terminal or command prompt.
Run the following command:
```
yarn
```
This command tells your computer to install all the necessary pieces that the project needs to run. It's like getting all the right tools and materials before starting a project.

### Compiles and hot-reloads for development
```
yarn dev
```
This command starts a development server. It helps you see and test your project while you're working on it.

### Compiles and minifies for production

```
yarn build
```
This command optimizes your project for production use. It bundles and compresses your code, making it faster and more efficient.

### Lints and fixes files

```
yarn run lint
```
Linting is a process that checks your code for common mistakes and coding standards. This command ensures your code is clean, consistent, and free of errors,

### Development Guide

Use `http://localhost:8080/#/fabien.eth` for testing your code.

By default your instance will connect to the hub at `https://testnet.snapshot.org`. To change that (or other values) you can create a `.env.local` and overwrite the values from `.env`.

## Running service locally with Docker
1. Run `docker build -t snapshot .` to build the image
2. Run `docker run --name snapshot -p 8080:8080 snapshot` to run the container
3. Go to `http://localhost:8080/#/fabien.eth` to test your code

## License

Snapshot is open-sourced software licensed under the © [MIT license](LICENSE).
