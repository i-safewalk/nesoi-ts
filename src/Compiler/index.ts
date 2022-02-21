import * as fs from 'fs';
import { $ } from './Schema';
import path from 'path';
import MigrationCompiler from './MigrationCompiler';
import ModelCompiler from './ModelCompiler';


export default class Compiler {

    static path = {
        schemas: path.join('app','Nodes'),
        build: {
            migrations: path.join('database','migrations','nodes'),
            models: path.join('app','Nodes','build')
        }
    }

    static async CreateBuildDir() {
        if (!fs.existsSync(this.path.build.migrations)) {
            fs.mkdirSync(this.path.build.migrations, {recursive: true});
        }
        if (!fs.existsSync(this.path.build.models)) {
            fs.mkdirSync(this.path.build.models, {recursive: true});
        }
    }

    static async LoadNodeSchemas(): Promise<$.Node[]> {

        let file_names = fs.readdirSync(this.path.schemas);
        file_names = file_names.filter(file_name => 
            fs.lstatSync(path.join(this.path.schemas,file_name)).isFile()
        )

        let files = await Promise.all(file_names.map(async file_name => {
            let module = file_name.replace('.ts','');
            //return (await import(path.join('..','..',this.path.schemas,module))).default;
            return (await import(path.join(process.cwd(),this.path.schemas,module))).default;
        }))

        return files;
    }
    
    static async Compile() {
        
        let schemas = await this.LoadNodeSchemas();
        
        this.CreateBuildDir();
        
        MigrationCompiler.Compile(schemas, this.path.build.migrations);
        ModelCompiler.Compile(schemas, this.path.build.models);

    }

}