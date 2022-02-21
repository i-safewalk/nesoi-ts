import * as fs from 'fs';
import path from 'path';
import Console from '../Common/Console';
import { Status } from '../Common/Status';
import { Camelize } from '../Common/String';
import { $ } from './Schema';

const Types = {
    string: 'string',
    int: 'number',
    float: 'number'
};

export default class NodeCompiler {
    
    /* Header */

    static CompileImports(schema: $.Node) {

        let model_name = Camelize(schema.name) + 'Model'

        let buf = `import ${model_name} from './${model_name}'\n`;
        buf += `import { Exception as BaseException } from '@adonisjs/core/build/standalone'\n`;
        buf += `import { schema } from '@ioc:Adonis/Core/Validator'\n`;
        buf += `import { Prop } from 'adonis-graph-db/lib/Prop'\n`;
        buf += `import Node, { NodeEntity } from 'adonis-graph-db/lib/Node'\n`;
        buf += `import { isEmpty, RequiredOnCreate } from 'adonis-graph-db/lib/Validator'\n`;
        buf += `import { Status } from 'adonis-graph-db/lib/Common/Status'\n`;

        buf += '\n';
        return buf;
    }

    static CompileDeclaration(schema: $.Node) {
        let node_name = Camelize(schema.name)

        let buf = `export interface ${node_name} extends NodeEntity<typeof ${node_name}Node.builder> {}\n`;
        buf += `export default class ${node_name}Node extends Node<any, ${node_name}> {\n`;

        buf += '\n';
        return buf;
    }

    /* Input */

    static CompileInputRuleProp(prop: $.Prop.I) {
        if (prop.opts.scope !== 'public') return null;
        let args = '';
        if (!prop.opts.default) {
            if (prop.type === 'string') args += '{},RequiredOnCreate'
            else args += 'RequiredOnCreate'
        }
        let buf = `\t\t\t${prop.name}: schema.${Types[prop.type]}.optional(${args})`;
        return buf;
    }

    static CompileInputNameProp(prop: $.Prop.I) {
        if (prop.opts.scope !== 'public') return null;
        let buf = `\t\t\t${prop.name}: '${prop.alias}'`;
        return buf;
    }

    static CompileInputRules(schema: $.Node) {
        let buf = `\t\trules: {\n`;
        let props = Object.values(schema.props).map(prop => this.CompileInputRuleProp(prop as any)).filter(p => p)
        buf += props.join(',\n')+'\n';
        buf += '\t\t},\n';        
        return buf;
    }

    static CompileInputNames(schema: $.Node) {
        let buf = `\t\tnames: {\n`;
        let props = Object.values(schema.props).map(prop => this.CompileInputNameProp(prop as any)).filter(p => p)
        buf += props.join(',\n')+'\n';
        buf += '\t\t},\n';        
        return buf;
    }

    static CompileInput(schema: $.Node) {
        let buf = `\tstatic input = {\n`;
        buf += this.CompileInputRules(schema);
        buf += this.CompileInputNames(schema);
        buf += '\t}\n\n';        
        return buf;
    }

    /* Builder */

    static CompileBuilderProp(prop: $.Prop.I) {
        if (prop.opts.scope === 'private') return null;
        let buf = `\t\t${prop.name}: Prop.Field('${prop.name}')`;
        return buf;
    }

    static CompileBuilder(schema: $.Node) {
        let buf = `\tstatic builder = {\n`;
        let props = Object.values(schema.props).map(prop => this.CompileBuilderProp(prop as any)).filter(p => p)
        buf += props.join(',\n')+'\n';
        buf += '\t}\n\n';        
        return buf;
    }

    /* Expand */

    static CompileExpand(_schema: $.Node) {
        let buf = `\tstatic expand = {\n`;
        buf += '\t}\n\n';
        return buf;
    }

    /* Create */

    static CompileCreateRule(rule: $.Rule.I) {
        let buf = `\t\t${rule.code}\n`;
        return buf;
    }

    static CompileCreateRules(schema: $.Node) {
        let buf = '';
        schema.rules.forEach(rule => {
            buf += this.CompileCreateRule(rule as any);
        })
        buf += '\n';
        return buf;
    }

    static CompileCreateModelProp(prop: $.Prop.I) {
        if (prop.opts.scope !== 'public') return '';
        return `\t\tmodel.${prop.name} = input.${prop.name};\n`
    }

    static CompileCreateModel(schema: $.Node) {
        let model_name = Camelize(schema.name)+'Model';
        let buf = `\t\tlet model = new ${model_name}();\n`;
        Object.values(schema.props).forEach(prop => {
            buf += this.CompileCreateModelProp(prop as any);
        })
        buf += `\t\treturn model;\n`;
        return buf;
    }

    static CompileCreate(schema: $.Node) {
        let model_name = Camelize(schema.name)+'Model';
        let buf = `\tasync doCreate(input: Input): Promise<${model_name}> {\n\n`;
        buf += this.CompileCreateRules(schema);
        buf += this.CompileCreateModel(schema);
        buf += `\t}\n\n`;
        return buf;
    }

    /* Update */

    static CompileUpdateModelProp(prop: $.Prop.I) {
        if (prop.opts.scope !== 'public') return '';
        return `\t\tif (!isEmpty(input.${prop.name})) model.${prop.name} = input.${prop.name};\n`
    }

    static CompileUpdateModel(schema: $.Node) {
        let buf = '';
        Object.values(schema.props).forEach(prop => {
            buf += this.CompileUpdateModelProp(prop as any);
        })
        buf += `\t\treturn model;\n`;
        return buf;
    }

    static CompileUpdate(schema: $.Node) {
        let model_name = Camelize(schema.name)+'Model';
        let buf = `\tasync doUpdate(model: ${model_name}, input: Input): Promise<${model_name}> {\n`;
        buf += this.CompileUpdateModel(schema);
        buf += `\t}\n\n`;
        return buf;
    }

    /* Input Type */

    static CompileInputType(schema: $.Node) {
        let node_name = Camelize(schema.name)+'Node'
        return `type Input = { [key in keyof typeof ${node_name}.input.rules]?: any }\n\n`
    }

    /* Exceptions */

    static CompileException(exception: $.Rule.Exception) {
        let args = exception.args.map(arg => `${arg.name}:${arg.type}`).join(', ');
        let buf = `\tstatic ${exception.name}(${args}) {\n`
        buf += `\t\treturn new this(\`${exception.msg}\`, Status.${Status[exception.status]}, this.code);\n`
        buf += '\t}\n\n'
        return buf;
    }

    static CompileExceptions(schema: $.Node) {
        let exceptions = schema.rules
            .map(rule => (rule as any as $.Rule.I).exception)
            .filter(r => r)
        if (!exceptions.length) return '';
        let buf = `class Exception extends BaseException {\n`;
        buf += `\tstatic code = 'E_${schema.name.toUpperCase()}'\n\n`;
        exceptions.forEach(exception => {
            buf += this.CompileException(exception!)
        })
        buf += '}'
        return buf;
    }

    /* Main */

    static CompileSchema(schema: $.Node) {
        Console.info('NodeCompiler', `Compiling ${Console.colored(schema.name,'cyan')}`)

        let model_name = Camelize(schema.name)+'Model'

        let buf = this.CompileImports(schema);
        buf += this.CompileDeclaration(schema);

        buf += `\tstatic alias = '${schema.alias}'\n`
        buf += `\tstatic model = ${model_name}\n\n`

        buf += this.CompileInput(schema);
        buf += this.CompileBuilder(schema);
        buf += this.CompileExpand(schema);
        buf += this.CompileCreate(schema);
        buf += this.CompileUpdate(schema);
        buf += '}\n\n'

        buf += this.CompileInputType(schema);
        buf += this.CompileExceptions(schema);

        return buf;
    }

    static Save(buf: string, out_path: string, name: string) {
        name = Camelize(name) + 'Node.ts'
        let file_path = path.join(out_path,name);
        Console.info('NodeCompiler', `Saving ${Console.colored(file_path,'green')}`)
        fs.writeFileSync(file_path, buf);   
    }

    static Compile(schema: $.Node, out_path: string) {
        let buf = this.CompileSchema(schema);
        this.Save(buf, out_path, schema.name);
    }

}