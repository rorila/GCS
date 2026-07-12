import { KnowledgeChunk } from './KnowledgeChunk';

/**
 * MarkdownChunker
 *
 * Zerlegt Markdown-Dokumente in KnowledgeChunks.
 * - Zuerst an ##-Headings trennen.
 * - Lange Abschnitte an ###-Headings trennen.
 * - Methodenabschnitte bleiben zusammen.
 * - Beispiele und Warnungen werden nicht vom Methodenkopf getrennt.
 */

/** Abschnitte unterhalb dieser Zeichenlänge werden nicht weiter an ### gesplittet. */
const LONG_SECTION_THRESHOLD = 1500;

export class MarkdownChunker {
    public chunk(markdown: string, sourcePath: string): KnowledgeChunk[] {
        const chunks: KnowledgeChunk[] = [];
        const topSections = this.splitByHeading(markdown, 2);

        for (const section of topSections) {
            const isLong = section.content.length > LONG_SECTION_THRESHOLD;
            const subSections = isLong ? this.splitByHeading(section.content, 3) : [];

            if (subSections.length <= 1 || this.shouldKeepTogether(section.title)) {
                chunks.push(
                    this.createChunk(section.title, [sourcePath, section.title], section.content)
                );
                continue;
            }

            for (const sub of subSections) {
                chunks.push(
                    this.createChunk(
                        sub.title,
                        [sourcePath, section.title, sub.title],
                        sub.content
                    )
                );
            }
        }

        return chunks;
    }

    private splitByHeading(markdown: string, level: number): Array<{ title: string; content: string }> {
        const regex = new RegExp(`^#{${level}}\\s+(.+)$`, 'gm');
        const sections: Array<{ title: string; content: string }> = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        let firstTitle = 'Einleitung';

        while ((match = regex.exec(markdown)) !== null) {
            if (sections.length === 0 && match.index > 0) {
                sections.push({
                    title: firstTitle,
                    content: markdown.slice(0, match.index).trim(),
                });
            } else if (sections.length > 0) {
                sections[sections.length - 1].content = markdown.slice(lastIndex, match.index).trim();
            }

            sections.push({ title: match[1].trim(), content: '' });
            lastIndex = match.index + match[0].length;
        }

        if (sections.length > 0) {
            sections[sections.length - 1].content = markdown.slice(lastIndex).trim();
        } else {
            sections.push({ title: firstTitle, content: markdown.trim() });
        }

        return sections;
    }

    private shouldKeepTogether(title: string): boolean {
        const t = title.toLowerCase();
        return t.includes('method') || t.includes('workflow') || t.includes('rezept');
    }

    private createChunk(title: string, sectionPath: string[], content: string): KnowledgeChunk {
        const chunkType = this.guessChunkType(title, content);
        return {
            id: this.buildChunkId(chunkType, title, sectionPath),
            title,
            sectionPath,
            content,
            tags: this.extractTags(title, content),
            entities: this.extractEntities(title, content),
            chunkType,
            contentHash: this.hashCode(content),
        };
    }

    private buildChunkId(chunkType: string, title: string, sectionPath: string[]): string {
        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60);
        const pathHash = this.hashCode(sectionPath.join('/')).slice(0, 6);
        return `${chunkType}-${slug || 'untitled'}-${pathHash}`;
    }

    private hashCode(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }

    private extractTags(title: string, content: string): string[] {
        const tags = new Set<string>();
        const hay = (title + ' ' + content).toLowerCase();

        if (hay.includes('method') || /`[a-zA-Z0-9_]+`\s*\(/.test(content)) tags.add('method');
        if (hay.includes('action') || hay.includes('actiontype')) tags.add('action');
        if (hay.includes('component') || hay.includes('komponent')) tags.add('component');
        if (hay.includes('workflow') || hay.includes('rezept')) tags.add('workflow');
        if (hay.includes('validator') || hay.includes('validierung')) tags.add('validator');
        if (hay.includes('anti-pattern') || hay.includes('anti pattern')) tags.add('anti-pattern');
        if (hay.includes('regel') || hay.includes('rule')) tags.add('rule');

        return Array.from(tags);
    }

    private extractEntities(title: string, content: string): string[] {
        const entities = new Set<string>();

        for (const w of title.split(/[^a-zA-Z0-9_]+/)) {
            if (w) entities.add(w);
        }

        const codeMatches = content.match(/`[a-zA-Z0-9_]+`/g) || [];
        for (const m of codeMatches) {
            entities.add(m.replace(/`/g, ''));
        }

        const methodMatches = content.match(/[a-zA-Z0-9_]+\s*\(/g) || [];
        for (const m of methodMatches) {
            entities.add(m.replace(/\s*\(/, '').trim());
        }

        return Array.from(entities);
    }

    private guessChunkType(title: string, content: string): KnowledgeChunk['chunkType'] {
        const t = title.toLowerCase();

        if (t.includes('anti-pattern') || t.includes('anti pattern') || t.includes('nicht tun')) return 'antiPattern';
        if (t.includes('workflow') || t.includes('rezept') || t.includes('end-to-end')) return 'workflow';
        if (t.includes('validator') || t.includes('validierung') || t.includes('validator-regeln')) return 'validator';
        if (t.includes('komponent') || t.includes('component') || t.includes('steckbrief')) return 'component';
        if (t.includes('action') || t.includes('actiontype')) return 'actionType';
        if (t.includes('method') || /`[a-zA-Z0-9_]+`\s*\(/.test(content) || /public\s+[a-zA-Z0-9_]+\s*\(/.test(content)) return 'method';
        if (t.includes('regel') || t.includes('rule')) return 'rule';

        return 'rule';
    }
}
