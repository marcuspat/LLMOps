/**
 * Code Data Processor
 * Specialized data processing pipeline for analyzing and extracting features from source code
 */

import * as tf from '@tensorflow/tfjs-node';
import { EventEmitter } from 'events';
import {
  CodeAnalysisFeatures,
  FeatureType,
  PreprocessingConfig,
  DatasetInfo,
  FeatureInfo,
  QualityFeatures,
  ComplexityFeatures,
  SyntacticFeatures,
  SemanticFeatures,
  StructuralFeatures
} from '../../types/ml.js';
import { Logger } from 'winston';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ASTParser } from './ASTParser.js';
import { FeatureExtractor } from './FeatureExtractor.js';
import { CodeTokenizer } from './CodeTokenizer.js';
import { DataValidator } from './DataValidator.js';
import { DataAugmenter } from './DataAugmenter.js';

export interface CodeDataset {
  name: string;
  files: CodeFile[];
  features: CodeAnalysisFeatures[];
  labels?: any[];
  metadata: CodeDatasetMetadata;
}

export interface CodeFile {
  path: string;
  content: string;
  language: string;
  size: number;
  lastModified: Date;
  hash: string;
}

export interface CodeDatasetMetadata {
  totalFiles: number;
  totalLines: number;
  totalCharacters: number;
  languages: Record<string, number>;
  averageFileSize: number;
  complexityDistribution: Record<string, number>;
  qualityDistribution: Record<string, number>;
}

export interface ProcessingOptions {
  includeComments?: boolean;
  includeAST?: boolean;
  includeMetrics?: boolean;
  includeQuality?: boolean;
  includeComplexity?: boolean;
  normalizeFeatures?: boolean;
  filterLanguages?: string[];
  minFileSize?: number;
  maxFileSize?: number;
}

export class CodeDataProcessor extends EventEmitter {
  private supportedLanguages: Set<string> = new Set([
    'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'go', 'rust',
    'php', 'ruby', 'csharp', 'swift', 'kotlin', 'scala', 'r', 'sql'
  ]);

  private logger: Logger;
  private astParser: ASTParser;
  private featureExtractor: FeatureExtractor;
  private codeTokenizer: CodeTokenizer;
  private dataValidator: DataValidator;
  private dataAugmenter: DataAugmenter;

  constructor(logger: Logger) {
    super();
    this.logger = logger;

    this.astParser = new ASTParser(logger);
    this.featureExtractor = new FeatureExtractor(logger);
    this.codeTokenizer = new CodeTokenizer(logger);
    this.dataValidator = new DataValidator(logger);
    this.dataAugmenter = new DataAugmenter(logger);
  }

  /**
   * Process a code directory and extract features
   */
  async processCodeDirectory(
    directoryPath: string,
    options: ProcessingOptions = {}
  ): Promise<CodeDataset> {
    this.logger.info(`Processing code directory: ${directoryPath}`);

    try {
      // Scan directory for code files
      const files = await this.scanCodeDirectory(directoryPath, options);

      this.logger.info(`Found ${files.length} code files to process`);

      // Process each file and extract features
      const features: CodeAnalysisFeatures[] = [];
      let processedCount = 0;

      for (const file of files) {
        try {
          const fileFeatures = await this.processCodeFile(file, options);
          features.push(fileFeatures);
          processedCount++;

          if (processedCount % 100 === 0) {
            this.logger.info(`Processed ${processedCount}/${files.length} files`);
          }

        } catch (error) {
          this.logger.warn(`Failed to process file ${file.path}:`, error);
        }
      }

      this.logger.info(`Successfully processed ${processedCount} files`);

      // Calculate dataset metadata
      const metadata = await this.calculateDatasetMetadata(files, features);

      // Create dataset
      const dataset: CodeDataset = {
        name: path.basename(directoryPath),
        files,
        features,
        metadata
      };

      // Emit processing completed event
      this.emit('processing_completed', { dataset, directoryPath });

      return dataset;

    } catch (error) {
      this.logger.error(`Failed to process code directory ${directoryPath}:`, error);
      throw error;
    }
  }

  /**
   * Process a single code file
   */
  async processCodeFile(file: CodeFile, options: ProcessingOptions = {}): Promise<CodeAnalysisFeatures> {
    this.logger.debug(`Processing file: ${file.path}`);

    try {
      // Parse AST if requested
      let ast: any = null;
      if (options.includeAST !== false) {
        ast = await this.astParser.parse(file.content, file.language);
      }

      // Extract syntactic features
      const syntactic = await this.extractSyntacticFeatures(file, ast);

      // Extract semantic features
      const semantic = await this.extractSemanticFeatures(file, ast);

      // Extract structural features
      const structural = await this.extractStructuralFeatures(file, ast);

      // Extract complexity features
      const complexity = options.includeComplexity !== false
        ? await this.extractComplexityFeatures(file, ast)
        : {} as ComplexityFeatures;

      // Extract quality features
      const quality = options.includeQuality !== false
        ? await this.extractQualityFeatures(file, ast, syntactic, semantic, structural, complexity)
        : {} as QualityFeatures;

      const features: CodeAnalysisFeatures = {
        syntactic,
        semantic,
        structural,
        complexity,
        quality
      };

      // Validate features
      await this.dataValidator.validateFeatures(features);

      return features;

    } catch (error) {
      this.logger.error(`Failed to process file ${file.path}:`, error);
      throw error;
    }
  }

  /**
   * Preprocess features for ML training
   */
  async preprocessFeatures(
    features: CodeAnalysisFeatures[],
    config: PreprocessingConfig
  ): Promise<{ processedFeatures: number[][], featureInfo: FeatureInfo[] }> {
    this.logger.info(`Preprocessing ${features.length} feature sets`);

    try {
      // Convert features to numerical format
      const numericalFeatures = features.map(f => this.featuresToNumerical(f));

      // Apply scaling if configured
      let scaledFeatures = numericalFeatures;
      if (config.scaling?.method !== 'none') {
        scaledFeatures = await this.applyScaling(numericalFeatures, config.scaling!);
      }

      // Apply feature selection if configured
      let finalFeatures = scaledFeatures;
      let selectedFeatures = this.getAllFeatureInfo();
      if (config.featureSelection) {
        const selectionResult = await this.applyFeatureSelection(
          finalFeatures,
          config.featureSelection
        );
        finalFeatures = selectionResult.features;
        selectedFeatures = selectionResult.featureInfo;
      }

      // Apply dimensionality reduction if configured
      if (config.dimensionalityReduction) {
        const reductionResult = await this.applyDimensionalityReduction(
          finalFeatures,
          config.dimensionalityReduction
        );
        finalFeatures = reductionResult.features;
      }

      // Validate preprocessed features
      await this.dataValidator.validatePreprocessedFeatures(finalFeatures);

      return {
        processedFeatures: finalFeatures,
        featureInfo: selectedFeatures
      };

    } catch (error) {
      this.logger.error('Feature preprocessing failed:', error);
      throw error;
    }
  }

  /**
   * Augment training data
   */
  async augmentData(
    features: CodeAnalysisFeatures[],
    labels: any[],
    config: any
  ): Promise<{ augmentedFeatures: CodeAnalysisFeatures[], augmentedLabels: any[] }> {
    this.logger.info(`Augmenting ${features.length} samples`);

    try {
      if (!config.enabled) {
        return { augmentedFeatures: features, augmentedLabels: labels };
      }

      const augmentedResults = await this.dataAugmenter.augment(
        features,
        labels,
        config.methods,
        config.parameters
      );

      return augmentedResults;

    } catch (error) {
      this.logger.error('Data augmentation failed:', error);
      throw error;
    }
  }

  /**
   * Create dataset info for ML pipeline
   */
  createDatasetInfo(
    name: string,
    features: CodeAnalysisFeatures[],
    labels?: any[],
    preprocessing?: PreprocessingConfig
  ): DatasetInfo {
    const numericalFeatures = features.map(f => this.featuresToNumerical(f));
    const featureSize = numericalFeatures[0]?.length || 0;

    // Analyze feature types
    const featureInfo = this.analyzeFeatureTypes(features);

    return {
      name,
      source: 'code_analysis',
      size: features.length,
      features: featureInfo,
      labels: labels ? this.analyzeLabels(labels) : undefined,
      preprocessing,
      splits: {
        train: 0.7,
        validation: 0.15,
        test: 0.15,
        shuffle: true,
        stratify: true
      }
    };
  }

  // Private helper methods

  private async scanCodeDirectory(directoryPath: string, options: ProcessingOptions): Promise<CodeFile[]> {
    const files: CodeFile[] = [];

    async function scanDirectory(dirPath: string): Promise<void> {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Skip common ignore directories
          if (['node_modules', '.git', 'dist', 'build', '.vscode', '__pycache__'].includes(entry.name)) {
            continue;
          }
          await scanDirectory(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          const language = this.getLanguageFromExtension(ext);

          if (language && (!options.filterLanguages || options.filterLanguages.includes(language))) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const stats = await fs.stat(fullPath);

              // Apply size filters
              if (options.minFileSize && stats.size < options.minFileSize) continue;
              if (options.maxFileSize && stats.size > options.maxFileSize) continue;

              files.push({
                path: fullPath,
                content,
                language,
                size: stats.size,
                lastModified: stats.mtime,
                hash: this.calculateHash(content)
              });

            } catch (error) {
              this.logger.warn(`Failed to read file ${fullPath}:`, error);
            }
          }
        }
      }
    }

    await scanDirectory(directoryPath);
    return files;
  }

  private getLanguageFromExtension(extension: string): string | null {
    const extensionMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.cxx': 'cpp',
      '.cc': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.cs': 'csharp',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.r': 'r',
      '.sql': 'sql'
    };

    return extensionMap[extension.toLowerCase()] || null;
  }

  private calculateHash(content: string): string {
    // Simple hash implementation - in production, use crypto
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private async extractSyntacticFeatures(file: CodeFile, ast: any): Promise<SyntacticFeatures> {
    const tokens = await this.codeTokenizer.tokenize(file.content, file.language);
    const lines = file.content.split('\n');
    const characters = file.content.length;

    const commentLines = lines.filter(line =>
      line.trim().startsWith('//') ||
      line.trim().startsWith('/*') ||
      line.trim().startsWith('*') ||
      line.trim().startsWith('#')
    ).length;

    const identifiers = await this.featureExtractor.extractIdentifiers(file.content, file.language);
    const keywords = await this.featureExtractor.extractKeywords(file.content, file.language);
    const operators = await this.featureExtractor.extractOperators(file.content, file.language);

    return {
      tokenCount: tokens.length,
      lineCount: lines.length,
      characterCount: characters,
      commentRatio: lines.length > 0 ? commentLines / lines.length : 0,
      identifierDensity: characters > 0 ? identifiers.length / characters : 0,
      keywordDensity: characters > 0 ? keywords.length / characters : 0,
      operatorDensity: characters > 0 ? operators.length / characters : 0
    };
  }

  private async extractSemanticFeatures(file: CodeFile, ast: any): Promise<SemanticFeatures> {
    if (!ast) {
      return {
        functionCount: 0,
        classCount: 0,
        importCount: 0,
        variableCount: 0,
        controlFlowComplexity: 0,
        dataFlowComplexity: 0,
        abstractionLevel: 0
      };
    }

    const functions = await this.featureExtractor.extractFunctions(ast, file.language);
    const classes = await this.featureExtractor.extractClasses(ast, file.language);
    const imports = await this.featureExtractor.extractImports(ast, file.language);
    const variables = await this.featureExtractor.extractVariables(ast, file.language);

    return {
      functionCount: functions.length,
      classCount: classes.length,
      importCount: imports.length,
      variableCount: variables.length,
      controlFlowComplexity: await this.calculateControlFlowComplexity(ast),
      dataFlowComplexity: await this.calculateDataFlowComplexity(ast),
      abstractionLevel: await this.calculateAbstractionLevel(ast)
    };
  }

  private async extractStructuralFeatures(file: CodeFile, ast: any): Promise<StructuralFeatures> {
    if (!ast) {
      return {
        nestingDepth: 0,
        coupling: 0,
        cohesion: 0,
        inheritanceDepth: 0,
        moduleSize: file.size,
        interfaceComplexity: 0,
        designPatterns: []
      };
    }

    return {
      nestingDepth: await this.calculateMaxNestingDepth(ast),
      coupling: await this.calculateCoupling(ast),
      cohesion: await this.calculateCohesion(ast),
      inheritanceDepth: await this.calculateInheritanceDepth(ast, file.language),
      moduleSize: file.size,
      interfaceComplexity: await this.calculateInterfaceComplexity(ast),
      designPatterns: await this.detectDesignPatterns(ast, file.language)
    };
  }

  private async extractComplexityFeatures(file: CodeFile, ast: any): Promise<ComplexityFeatures> {
    return {
      cyclomaticComplexity: await this.calculateCyclomaticComplexity(ast),
      cognitiveComplexity: await this.calculateCognitiveComplexity(ast),
      halsteadComplexity: await this.calculateHalsteadComplexity(file.content, file.language),
      maintainabilityIndex: await this.calculateMaintainabilityIndex(file, ast),
      technicalDebt: await this.estimateTechnicalDebt(file, ast),
      codeChurn: 0 // Would need git history for this
    };
  }

  private async extractQualityFeatures(
    file: CodeFile,
    ast: any,
    syntactic: SyntacticFeatures,
    semantic: SemanticFeatures,
    structural: StructuralFeatures,
    complexity: ComplexityFeatures
  ): Promise<QualityFeatures> {
    return {
      testCoverage: 0, // Would need test files for this
      bugDensity: await this.estimateBugDensity(complexity, syntactic),
      vulnerabilityCount: await this.detectVulnerabilities(file.content, file.language),
      codeSmells: await this.detectCodeSmells(ast, file.language),
      duplicationRatio: await this.estimateDuplication(file.content),
      documentationCoverage: syntactic.commentRatio
    };
  }

  private featuresToNumerical(features: CodeAnalysisFeatures): number[] {
    const result: number[] = [];

    // Syntactic features
    result.push(
      features.syntactic.tokenCount,
      features.syntactic.lineCount,
      features.syntactic.characterCount,
      features.syntactic.commentRatio,
      features.syntactic.identifierDensity,
      features.syntactic.keywordDensity,
      features.syntactic.operatorDensity
    );

    // Semantic features
    result.push(
      features.semantic.functionCount,
      features.semantic.classCount,
      features.semantic.importCount,
      features.semantic.variableCount,
      features.semantic.controlFlowComplexity,
      features.semantic.dataFlowComplexity,
      features.semantic.abstractionLevel
    );

    // Structural features
    result.push(
      features.structural.nestingDepth,
      features.structural.coupling,
      features.structural.cohesion,
      features.structural.inheritanceDepth,
      features.structural.moduleSize,
      features.structural.interfaceComplexity,
      features.structural.designPatterns.length
    );

    // Complexity features
    result.push(
      features.complexity.cyclomaticComplexity,
      features.complexity.cognitiveComplexity,
      features.complexity.halsteadComplexity,
      features.complexity.maintainabilityIndex,
      features.complexity.technicalDebt,
      features.complexity.codeChurn
    );

    // Quality features
    result.push(
      features.quality.testCoverage,
      features.quality.bugDensity,
      features.quality.vulnerabilityCount,
      features.quality.codeSmells,
      features.quality.duplicationRatio,
      features.quality.documentationCoverage
    );

    return result;
  }

  private async applyScaling(features: number[][], config: any): Promise<number[][]> {
    const tfFeatures = tf.tensor2d(features);

    switch (config.method) {
      case 'standard':
        const mean = tfFeatures.mean(0);
        const std = tfFeatures.sub(tfFeatures.mean(0, true)).pow(2).mean(0, true).sqrt();
        return tfFeatures.sub(mean).div(std).arraySync() as number[][];

      case 'minmax':
        const min = tfFeatures.min(0);
        const max = tfFeatures.max(0);
        const range = max.sub(min);
        return tfFeatures.sub(min).div(range).arraySync() as number[][];

      default:
        return features;
    }
  }

  private async applyFeatureSelection(features: number[][], config: any): Promise<any> {
    // Simple feature selection based on variance
    const tfFeatures = tf.tensor2d(features);
    const variance = tfFeatures.sub(tfFeatures.mean(0, true)).pow(2).mean(0, true);
    const threshold = config.threshold || 0.01;

    const mask = variance.greater(threshold);
    const selectedIndices = await mask.array() as boolean[];

    const selectedFeatures = features.map((row, i) =>
      row.filter((_, j) => selectedIndices[j])
    );

    return {
      features: selectedFeatures,
      featureInfo: this.getSelectedFeatureInfo(selectedIndices)
    };
  }

  private async applyDimensionalityReduction(features: number[][], config: any): Promise<any> {
    // Simple PCA implementation
    const tfFeatures = tf.tensor2d(features);
    const centered = tfFeatures.sub(tfFeatures.mean(0, true));

    // Compute covariance matrix
    const covariance = centered.transpose().matMul(centered).div(tfFeatures.shape[0]);

    // Compute eigenvalues and eigenvectors
    const { eigenvalues, eigenvectors } = await tf.eig(covariance);

    // Select top components
    const components = config.components || 10;
    const topComponents = eigenvectors.slice([0, 0], [-1, components]);

    // Project data
    const reduced = centered.matMul(topComponents);

    return {
      features: await reduced.array() as number[][]
    };
  }

  private getAllFeatureInfo(): FeatureInfo[] {
    return [
      // Syntactic features
      { name: 'tokenCount', type: FeatureType.NUMERICAL, encoding: 'raw', normalized: false },
      { name: 'lineCount', type: FeatureType.NUMERICAL, encoding: 'raw', normalized: false },
      // ... all other features
    ];
  }

  private getSelectedFeatureInfo(selected: boolean[]): FeatureInfo[] {
    const allFeatures = this.getAllFeatureInfo();
    return allFeatures.filter((_, index) => selected[index]);
  }

  private analyzeFeatureTypes(features: CodeAnalysisFeatures[]): FeatureInfo[] {
    // Implementation for analyzing feature types
    return this.getAllFeatureInfo();
  }

  private analyzeLabels(labels: any[]): any[] {
    // Implementation for analyzing label distribution
    return [];
  }

  private async calculateDatasetMetadata(files: CodeFile[], features: CodeAnalysisFeatures[]): Promise<CodeDatasetMetadata> {
    const languages: Record<string, number> = {};
    const totalLines = files.reduce((sum, file) => sum + file.content.split('\n').length, 0);
    const totalCharacters = files.reduce((sum, file) => sum + file.content.length, 0);

    files.forEach(file => {
      languages[file.language] = (languages[file.language] || 0) + 1;
    });

    const avgFileSize = files.reduce((sum, file) => sum + file.size, 0) / files.length;

    return {
      totalFiles: files.length,
      totalLines,
      totalCharacters,
      languages,
      averageFileSize: avgFileSize,
      complexityDistribution: {},
      qualityDistribution: {}
    };
  }

  // Additional complexity calculation methods (simplified implementations)
  private async calculateControlFlowComplexity(ast: any): Promise<number> {
    return Math.floor(Math.random() * 20) + 5; // Placeholder
  }

  private async calculateDataFlowComplexity(ast: any): Promise<number> {
    return Math.floor(Math.random() * 15) + 3; // Placeholder
  }

  private async calculateAbstractionLevel(ast: any): Promise<number> {
    return Math.random(); // Placeholder
  }

  private async calculateMaxNestingDepth(ast: any): Promise<number> {
    return Math.floor(Math.random() * 10) + 1; // Placeholder
  }

  private async calculateCoupling(ast: any): Promise<number> {
    return Math.floor(Math.random() * 15) + 2; // Placeholder
  }

  private async calculateCohesion(ast: any): Promise<number> {
    return Math.random(); // Placeholder
  }

  private async calculateInheritanceDepth(ast: any, language: string): Promise<number> {
    return Math.floor(Math.random() * 5); // Placeholder
  }

  private async calculateInterfaceComplexity(ast: any): Promise<number> {
    return Math.floor(Math.random() * 20) + 5; // Placeholder
  }

  private async detectDesignPatterns(ast: any, language: string): Promise<string[]> {
    return []; // Placeholder
  }

  private async calculateCyclomaticComplexity(ast: any): Promise<number> {
    return Math.floor(Math.random() * 30) + 10; // Placeholder
  }

  private async calculateCognitiveComplexity(ast: any): Promise<number> {
    return Math.floor(Math.random() * 50) + 15; // Placeholder
  }

  private async calculateHalsteadComplexity(content: string, language: string): Promise<number> {
    return Math.floor(Math.random() * 100) + 50; // Placeholder
  }

  private async calculateMaintainabilityIndex(file: CodeFile, ast: any): Promise<number> {
    return Math.random() * 100; // Placeholder
  }

  private async estimateTechnicalDebt(file: CodeFile, ast: any): Promise<number> {
    return Math.floor(Math.random() * 1000) + 100; // Placeholder
  }

  private async estimateBugDensity(complexity: ComplexityFeatures, syntactic: SyntacticFeatures): Promise<number> {
    return Math.random() * 0.1; // Placeholder
  }

  private async detectVulnerabilities(content: string, language: string): Promise<number> {
    return Math.floor(Math.random() * 5); // Placeholder
  }

  private async detectCodeSmells(ast: any, language: string): Promise<number> {
    return Math.floor(Math.random() * 10); // Placeholder
  }

  private async estimateDuplication(content: string): Promise<number> {
    return Math.random() * 0.3; // Placeholder
  }
}