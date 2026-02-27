import { GameProject, SequenceItem } from '../model/types';
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
     * Generates a single Pascal procedure for a task.
     * Delegates to PascalCodeGenerator.
     */
    public static generateProcedure(project: GameProject, taskName: string, indent: number = 0, sequenceOverride?: SequenceItem[], asHtml: boolean = true, activeStage?: any): string {
        return PascalCodeGenerator.generateProcedure(project, taskName, indent, sequenceOverride, asHtml, activeStage);
    }

    /**
     * Parses a full Pascal program and updates the GameProject.
     * Delegates to PascalCodeParser.
     */
    public static parse(project: GameProject, code: string, targetStage?: any): void {
        PascalCodeParser.parse(project, code, targetStage);
    }

    /**
     * Logic Signature calculation (moved to Parser but kept here for compatibility if needed).
     */
    public static getLogicSignature(sequence: SequenceItem[]): string {
        return (PascalCodeParser as any).getLogicSignature(sequence);
    }
}
