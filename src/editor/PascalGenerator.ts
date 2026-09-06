import { GameProject } from '../model/types';
import { PascalCodeGenerator } from './PascalCodeGenerator';
import { PascalCodeParser } from './PascalCodeParser';

/**
 * PascalGenerator - Facade for Pascal code generation and parsing.
 * Delegates work to PascalCodeGenerator and PascalCodeParser.
 */
export class PascalGenerator {

    /**
     * Generates a full Pascal program representation of the project.
     * Delegates to PascalCodeGenerator.
     */
    public static generateFullProgram(project: GameProject, asHtml: boolean = true, activeStage?: any): string {
        return PascalCodeGenerator.generateFullProgram(project, asHtml, activeStage);
    }

    /**
     * Generates Pascal code filtered for a specific task and its related procedures.
     * Delegates to PascalCodeGenerator.
     */
    public static generateForTask(project: GameProject, taskName: string, asHtml: boolean = true, activeStage?: any): string {
        return PascalCodeGenerator.generateForTask(project, taskName, asHtml, activeStage);
    }

    /**
     * Parses a full Pascal program and updates the GameProject.
     * Delegates to PascalCodeParser.
     */
    public static parse(project: GameProject, code: string, targetStage?: any): void {
        PascalCodeParser.parse(project, code, targetStage);
    }
}
