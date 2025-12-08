import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseComponent } from '../shared/base-classes.js';

interface FileMetrics {
  filePath: string;
  lines: number;
  complexity: number;
  functions: number;
  classes: number;
  maxFunctionLength: number;
  maxNestingDepth: number;
  duplicatedBlocks: number;
}

interface ComplexityReport {
  totalFiles: number;
  totalLines: number;
  totalComplexity: number;
  averageComplexity: number;
  highComplexityFiles: FileMetrics[];
  duplicatedCodeBlocks: number;
  maintainabilityIndex: number;
  recommendations: string[];
}

export class ComplexityAnalyzer extends BaseComponent {
  private readonly COMPLEXITY_THRESHOLDS = {
    LOW: 5,
    MEDIUM: 10,
    HIGH: 20,
    VERY_HIGH: 50
  };

  private readonly MAINTAINABILITY_FACTORS = {
    COMPLEXITY_WEIGHT: 0.4,
    DUPLICATION_WEIGHT: 0.3,
    SIZE_WEIGHT: 0.2,
    NESTING_WEIGHT: 0.1
  };

  public async analyzeDirectory(directoryPath: string): Promise<ComplexityReport> {
    const files = await this.getFilesRecursively(directoryPath, ['.ts', '.js']);
    const fileMetrics: FileMetrics[] = [];

    for (const filePath of files) {
      const metrics = await this.analyzeFile(filePath);
      fileMetrics.push(metrics);
    }

    return this.generateReport(fileMetrics);
  }

  private async getFilesRecursively(dir: string, extensions: string[]): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
        const subFiles = await this.getFilesRecursively(fullPath, extensions);
        files.push(...subFiles);
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];
    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  private async analyzeFile(filePath: string): Promise<FileMetrics> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    return {
      filePath,
      lines: lines.length,
      complexity: this.calculateCyclomaticComplexity(content),
      functions: this.countFunctions(content),
      classes: this.countClasses(content),
      maxFunctionLength: this.getMaxFunctionLength(content),
      maxNestingDepth: this.getMaxNestingDepth(content),
      duplicatedBlocks: this.detectDuplicatedBlocks(content)
    };
  }

  private calculateCyclomaticComplexity(content: string): number {
    const patterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\btry\b/g,
      /\b&&\b/g,
      /\|\|\|/g,
      /\?/g
    ];

    let complexity = 1; // Base complexity
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      complexity += matches?.length || 0;
    }

    return complexity;
  }

  private countFunctions(content: string): number {
    const patterns = [
      /function\s+\w+/g,
      /const\s+\w+\s*=\s*\(/g,
      /const\s+\w+\s*=\s*async\s*\(/g,
      /\w+\s*\([^)]*\)\s*{/g,
      /=>\s*{/g
    ];

    let count = 0;
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      count += matches?.length || 0;
    }

    return Math.max(0, count - 2); // Adjust for overcounting
  }

  private countClasses(content: string): number {
    const classMatches = content.match(/\bclass\s+\w+/g);
    return classMatches?.length || 0;
  }

  private getMaxFunctionLength(content: string): number {
    const functions = content.match(/function\s+\w+\s*\([^)]*\)\s*{[^}]*}/g) || [];
    const arrowFunctions = content.match(/\w+\s*=\s*\([^)]*\)\s*=>\s*{[^}]*}/g) || [];

    const allFunctions = [...functions, ...arrowFunctions];
    return Math.max(0, ...allFunctions.map(fn => fn.split('\n').length));
  }

  private getMaxNestingDepth(content: string): number {
    const lines = content.split('\n');
    let maxDepth = 0;
    let currentDepth = 0;

    for (const line of lines) {
      const openingBrackets = (line.match(/{/g) || []).length;
      const closingBrackets = (line.match(/}/g) || []).length;

      currentDepth += openingBrackets - closingBrackets;
      maxDepth = Math.max(maxDepth, currentDepth);
    }

    return maxDepth;
  }

  private detectDuplicatedBlocks(content: string): number {
    const lines = content.split('\n');
    const blockMap = new Map<string, number>();
    let duplicateCount = 0;

    // Look for duplicated blocks of 3+ lines
    for (let i = 0; i < lines.length - 2; i++) {
      const block = lines.slice(i, i + 3).join('\n').trim();

      if (block.length > 20) { // Ignore very short blocks
        const count = blockMap.get(block) || 0;
        if (count > 0) {
          duplicateCount++;
        }
        blockMap.set(block, count + 1);
      }
    }

    return duplicateCount;
  }

  private generateReport(fileMetrics: FileMetrics[]): ComplexityReport {
    const totalFiles = fileMetrics.length;
    const totalLines = fileMetrics.reduce((sum, f) => sum + f.lines, 0);
    const totalComplexity = fileMetrics.reduce((sum, f) => sum + f.complexity, 0);
    const averageComplexity = totalFiles > 0 ? totalComplexity / totalFiles : 0;

    const highComplexityFiles = fileMetrics.filter(f => f.complexity > this.COMPLEXITY_THRESHOLDS.HIGH);
    const totalDuplicatedBlocks = fileMetrics.reduce((sum, f) => sum + f.duplicatedBlocks, 0);

    const maintainabilityIndex = this.calculateMaintainabilityIndex(fileMetrics);

    return {
      totalFiles,
      totalLines,
      totalComplexity,
      averageComplexity,
      highComplexityFiles,
      duplicatedCodeBlocks: totalDuplicatedBlocks,
      maintainabilityIndex,
      recommendations: this.generateRecommendations(fileMetrics)
    };
  }

  private calculateMaintainabilityIndex(fileMetrics: FileMetrics[]): number {
    if (fileMetrics.length === 0) return 100;

    let totalScore = 0;

    for (const metrics of fileMetrics) {
      let fileScore = 100;

      // Penalty for complexity
      if (metrics.complexity > this.COMPLEXITY_THRESHOLDS.VERY_HIGH) {
        fileScore -= 40;
      } else if (metrics.complexity > this.COMPLEXITY_THRESHOLDS.HIGH) {
        fileScore -= 25;
      } else if (metrics.complexity > this.COMPLEXITY_THRESHOLDS.MEDIUM) {
        fileScore -= 10;
      }

      // Penalty for duplication
      if (metrics.duplicatedBlocks > 5) {
        fileScore -= 20;
      } else if (metrics.duplicatedBlocks > 2) {
        fileScore -= 10;
      }

      // Penalty for large functions
      if (metrics.maxFunctionLength > 50) {
        fileScore -= 15;
      } else if (metrics.maxFunctionLength > 25) {
        fileScore -= 5;
      }

      // Penalty for deep nesting
      if (metrics.maxNestingDepth > 5) {
        fileScore -= 10;
      } else if (metrics.maxNestingDepth > 3) {
        fileScore -= 5;
      }

      totalScore += Math.max(0, fileScore);
    }

    return Math.round(totalScore / fileMetrics.length);
  }

  private generateRecommendations(fileMetrics: FileMetrics[]): string[] {
    const recommendations: string[] = [];

    // Check for high complexity files
    const highComplexityCount = fileMetrics.filter(f => f.complexity > this.COMPLEXITY_THRESHOLDS.HIGH).length;
    if (highComplexityCount > 0) {
      recommendations.push(`Refactor ${highComplexityCount} file(s) with complexity > ${this.COMPLEXITY_THRESHOLDS.HIGH}`);
    }

    // Check for large functions
    const largeFunctionsCount = fileMetrics.filter(f => f.maxFunctionLength > 30).length;
    if (largeFunctionsCount > 0) {
      recommendations.push(`Break down ${largeFunctionsCount} file(s) with functions > 30 lines`);
    }

    // Check for duplication
    const totalDuplicated = fileMetrics.reduce((sum, f) => sum + f.duplicatedBlocks, 0);
    if (totalDuplicated > 5) {
      recommendations.push(`Extract ${totalDuplicated} duplicated code blocks into shared utilities`);
    }

    // Check for deep nesting
    const deepNestingCount = fileMetrics.filter(f => f.maxNestingDepth > 4).length;
    if (deepNestingCount > 0) {
      recommendations.push(`Reduce nesting depth in ${deepNestingCount} file(s) (current max > 4)`);
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('Code quality is good. Continue following current practices.');
    }

    return recommendations;
  }

  public async compareReports(before: ComplexityReport, after: ComplexityReport): Promise<{
    complexityReduction: number;
    maintainabilityImprovement: number;
    duplicationReduction: number;
    overallImprovement: number;
  }> {
    const complexityReduction = before.totalComplexity > 0
      ? ((before.totalComplexity - after.totalComplexity) / before.totalComplexity) * 100
      : 0;

    const maintainabilityImprovement = after.maintainabilityIndex - before.maintainabilityIndex;
    const duplicationReduction = before.duplicatedCodeBlocks > 0
      ? ((before.duplicatedCodeBlocks - after.duplicatedCodeBlocks) / before.duplicatedCodeBlocks) * 100
      : 0;

    const overallImprovement = (complexityReduction + maintainabilityImprovement + (duplicationReduction * 0.5)) / 2.5;

    return {
      complexityReduction,
      maintainabilityImprovement,
      duplicationReduction,
      overallImprovement
    };
  }
}