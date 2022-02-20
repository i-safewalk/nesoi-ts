import { spawn } from "child_process"

export default class Shell {

    /**
     * Execute command in shell.
     */
    static cmd(cwd: string, cmd: string, args: string[] = [], stdin?: string[], stdout = false) {
        console.log(cwd + '$ ' + cmd + ' ' + args.join(' '))
        return new Promise(resolve => {
            let child = spawn(cmd, args, {shell: true, stdio: [stdin?null:process.stdin, stdout?null:process.stdout, (process as any).error], cwd})
            if (stdin) stdin.map(input => child.stdin.write(input + '\n'))
            let out: string[] = []
            if (stdout) {
                child.stdout.on('data', msg => {
                    process.stdout.write(msg.toString())
                    out.push(msg.toString())
                })
            }
            child.on('error', msg => {
                console.error(msg)
                throw 'Something went wrong when running the shell command. Read the logs.'
            })
            child.on('close', _ => {
                resolve(out)
            })
        })
    }

    /** Replace regex match on a file  */
    static replaceInFile(cwd: string, file: string, from: string, to: string) {
        return this.cmd(cwd, 'sed', [ '-i', 's/'+from+'/"'+to+'"/', file])
    }

    /** Replace all regex matches on a file  */
    static replaceAllInFile(cwd: string, file: string, from: string, to: string) {
        return this.cmd(cwd, 'sed', [ '-i', 's/'+from+'/"'+to+'"/g', file])
    }

    /** Replace all regex matches on a file  */
    static replaceAllInFileQuoted(cwd: string, file: string, from: string, to: string) {
        return this.cmd(cwd, 'sed', [ '-i', '\'s/'+from+'/'+to+'/g\'', file])
    }

}