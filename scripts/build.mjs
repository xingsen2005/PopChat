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
    outfile: path.resolve(__dirname, '../dist/main.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    external: ['electron', 'electron-updater'],
    tsconfig: path.resolve(__dirname, '../tsconfig.json'),
    resolveExtensions: ['.ts', '.js', '.json']
  })
}

async function buildRenderer()
{
  return new Promise((resolve, reject) =>
  {
    const child = exec('node node_modules/vite/bin/vite.js build', {
      cwd: path.resolve(__dirname, '..')
    }, (error, stdout, stderr) =>
    {
      if (error)
      {
        reject(error)
      }
      else
      {
        resolve(stdout)
      }
    })
    child.stdout?.pipe(process.stdout)
    child.stderr?.pipe(process.stderr)
  })
}

async function copyAssets()
{
  await fs.copy(
    path.resolve(__dirname, '../src/preload.js'),
    path.resolve(__dirname, '../dist/preload.cjs')
  )
}

async function main()
{
  try
  {
    const distDir = path.resolve(__dirname, '../dist')
    const rendererDir = path.resolve(__dirname, '../dist/renderer')

    await fs.emptyDir(distDir)

    await buildMain()

    await fs.ensureDir(rendererDir)
    await buildRenderer()

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
