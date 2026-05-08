import { build } from 'esbuild'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs-extra'
import { exec } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function buildMain()
{
  await build({
    entryPoints: [path.resolve(__dirname, '../src/main.ts')],
    outfile: path.resolve(__dirname, '../dist/main.js'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    external: ['electron', 'electron-updater'],
    tsconfig: path.resolve(__dirname, '../tsconfig.json'),
    resolveExtensions: ['.ts', '.js', '.json']
  })
}

async function buildRenderer()
{
  await build({
    entryPoints: [path.resolve(__dirname, '../src/main.tsx')],
    outfile: path.resolve(__dirname, '../dist/renderer.js'),
    bundle: true,
    platform: 'browser',
    target: 'chrome110',
    tsconfig: path.resolve(__dirname, '../tsconfig.json'),
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    loader: {
      '.svg': 'dataurl',
      '.png': 'dataurl',
      '.jpg': 'dataurl'
    }
  })
}

async function buildCSS()
{
  const inputPath = `"${path.resolve(__dirname, '../src/index.css')}"`
  const outputPath = `"${path.resolve(__dirname, '../dist/style.css')}"`

  return new Promise((resolve, reject) =>
  {
    exec(
      `npx tailwindcss -i ${inputPath} -o ${outputPath}`,
      (error, stdout, stderr) =>
      {
        if (error)
        {
          reject(error)
        }
        else
        {
          resolve(stdout)
        }
      }
    )
  })
}

async function copyAssets()
{
  await fs.copy(
    path.resolve(__dirname, '../src/index.html'),
    path.resolve(__dirname, '../dist/index.html')
  )

  await fs.copy(
    path.resolve(__dirname, '../src/preload.js'),
    path.resolve(__dirname, '../dist/preload.js')
  )
}

async function main()
{
  try
  {
    await fs.emptyDir(path.resolve(__dirname, '../dist'))
    await buildMain()
    await buildRenderer()
    await buildCSS()
    await copyAssets()
    console.log('Build completed successfully!')
  }
  catch (error)
  {
    console.error('Build failed:', error)
    process.exit(1)
  }
}

main()
