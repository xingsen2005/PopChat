import { spawn } from 'child_process'
import { build } from 'esbuild'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs-extra'
import http from 'http'

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

function waitForViteReady(port: number, maxRetries = 30, interval = 1000): Promise<void>
{
  return new Promise((resolve, reject) =>
  {
    let retries = 0

    const check = () =>
    {
      const req = http.get(`http://localhost:${port}`, (res) =>
      {
        res.resume()
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400)
        {
          resolve()
        }
        else
        {
          retry()
        }
      })

      req.on('error', () =>
      {
        retry()
      })

      req.setTimeout(3000, () =>
      {
        req.destroy()
        retry()
      })
    }

    const retry = () =>
    {
      retries++
      if (retries >= maxRetries)
      {
        reject(new Error(`Vite dev server 在 ${maxRetries} 次重试后仍未就绪`))
        return
      }
      setTimeout(check, interval)
    }

    setTimeout(check, 500)
  })
}

async function main()
{
  await fs.emptyDir(path.resolve(__dirname, '../dist'))

  await buildMain()

  await fs.copy(
    path.resolve(__dirname, '../src/preload.js'),
    path.resolve(__dirname, '../dist/preload.js')
  )

  const vite = spawn('npx', ['vite'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit'
  })

  try
  {
    await waitForViteReady(5173)
    console.log('Vite dev server 已就绪，启动 Electron...')
  }
  catch (error)
  {
    console.error(error)
    vite.kill()
    process.exit(1)
  }

  const electron = spawn('npx', ['electron', '.'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
  })

  electron.on('close', (code) =>
  {
    vite.kill()
    console.log(`Electron process exited with code ${code}`)
    process.exit(code || 0)
  })

  process.on('SIGINT', () =>
  {
    electron.kill()
    vite.kill()
    process.exit(0)
  })
}

main()
