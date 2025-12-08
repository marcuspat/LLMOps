/**
 * Lagrange Interpolation - Polynomial interpolation for threshold signatures
 * Implements Lagrange coefficients for combining partial signatures
 */

import { Buffer } from 'buffer';
import * as crypto from 'crypto';

export class LagrangeInterpolation {
  private prime: bigint;

  constructor(prime?: bigint) {
    // Default to secp256k1 curve order
    this.prime = prime || BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  }

  /**
   * Compute Lagrange coefficients for given x-values
   */
  computeCoefficients(xValues: number[]): number[] {
    const coefficients: number[] = [];
    const n = xValues.length;

    for (let i = 0; i < n; i++) {
      let numerator = 1n;
      let denominator = 1n;

      // Compute Lagrange basis polynomial coefficient for point i
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          const xi = BigInt(xValues[i]);
          const xj = BigInt(xValues[j]);

          numerator = numerator * (-xj) % this.prime;
          denominator = denominator * (xi - xj) % this.prime;
        }
      }

      // Handle division by computing modular inverse
      const denominatorInverse = this.modInverse(denominator);
      const coefficient = (numerator * denominatorInverse) % this.prime;

      coefficients.push(Number(coefficient));
    }

    return coefficients;
  }

  /**
   * Interpolate polynomial value at given point
   */
  interpolateAt(points: { x: number; y: bigint }[], targetX: number): bigint {
    if (points.length === 0) {
      throw new Error('No points provided for interpolation');
    }

    const targetXBig = BigInt(targetX);
    let result = 0n;

    for (let i = 0; i < points.length; i++) {
      let term = points[i].y;
      const xi = BigInt(points[i].x);

      for (let j = 0; j < points.length; j++) {
        if (i !== j) {
          const xj = BigInt(points[j].x);

          // Compute term coefficient
          const numerator = (targetXBig - xj) % this.prime;
          const denominator = (xi - xj) % this.prime;
          const denominatorInverse = this.modInverse(denominator);

          term = (term * numerator * denominatorInverse) % this.prime;
        }
      }

      result = (result + term) % this.prime;
    }

    return result;
  }

  /**
   * Combine shares using Lagrange interpolation
   */
  combineShares(shares: { index: number; value: bigint }[]): bigint {
    if (shares.length === 0) {
      throw new Error('No shares provided for combination');
    }

    const points = shares.map(share => ({
      x: share.index,
      y: share.value
    }));

    // Interpolate at x=0 to recover secret
    return this.interpolateAt(points, 0);
  }

  /**
   * Verify that a set of points can uniquely determine a polynomial
   */
  canInterpolate(points: { x: number; y: bigint }[], degree: number): boolean {
    if (points.length <= degree) {
      return false;
    }

    // Check that all x-values are distinct
    const xValues = new Set(points.map(p => p.x));
    return xValues.size === points.length;
  }

  /**
   * Compute Lagrange coefficient for specific i and target
   */
  computeLagrangeCoefficient(
    i: number,
    xValues: number[],
    target: number = 0
  ): bigint {
    const xi = BigInt(xValues[i]);
    const targetBig = BigInt(target);
    let numerator = 1n;
    let denominator = 1n;

    for (let j = 0; j < xValues.length; j++) {
      if (i !== j) {
        const xj = BigInt(xValues[j]);
        numerator = numerator * (targetBig - xj) % this.prime;
        denominator = denominator * (xi - xj) % this.prime;
      }
    }

    const denominatorInverse = this.modInverse(denominator);
    return (numerator * denominatorInverse) % this.prime;
  }

  /**
   * Batch compute multiple coefficients
   */
  batchComputeCoefficients(
    xValues: number[],
    targets: number[]
  ): Map<number, number[]> {
    const result = new Map<number, number[]>();

    for (const target of targets) {
      const coefficients: number[] = [];

      for (let i = 0; i < xValues.length; i++) {
        const coefficient = this.computeLagrangeCoefficient(i, xValues, target);
        coefficients.push(Number(coefficient));
      }

      result.set(target, coefficients);
    }

    return result;
  }

  /**
   * Create polynomial commitment
   */
  createCommitment(coefficients: bigint[]): string {
    // Create commitment using hash of coefficients
    const combined = coefficients.map(c => c.toString(16).padStart(64, '0')).join('');
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Verify polynomial commitment
   */
  verifyCommitment(
    coefficients: bigint[],
    commitment: string,
    evaluations: { x: number; y: bigint }[]
  ): boolean {
    // Verify that the polynomial defined by coefficients
    // matches the provided evaluations
    const computedCommitment = this.createCommitment(coefficients);

    if (computedCommitment !== commitment) {
      return false;
    }

    // Verify evaluations
    for (const evaluation of evaluations) {
      const computedY = this.interpolateAt(
        coefficients.map((c, i) => ({ x: i, y: c })),
        evaluation.x
      );

      if (computedY !== evaluation.y) {
        return false;
      }
    }

    return true;
  }

  /**
   * Optimized interpolation for large sets
   */
  optimizedInterpolate(shares: { index: number; value: bigint }[]): bigint {
    if (shares.length === 0) {
      throw new Error('No shares provided for interpolation');
    }

    // Use Newton interpolation for better performance
    return this.newtonInterpolation(shares);
  }

  /**
   * Newton interpolation method
   */
  private newtonInterpolation(points: { index: number; value: bigint }[]): bigint {
    const n = points.length;

    // Sort points by x coordinate
    points.sort((a, b) => a.index - b.index);

    // Compute divided differences
    const dividedDifferences: bigint[][] = Array(n).fill(null).map(() => Array(n).fill(0n));

    for (let i = 0; i < n; i++) {
      dividedDifferences[i][0] = points[i].value;
    }

    for (let j = 1; j < n; j++) {
      for (let i = 0; i < n - j; i++) {
        const xi = BigInt(points[i].index);
        const xiPlusJ = BigInt(points[i + j].index);
        const denominator = (xiPlusJ - xi) % this.prime;
        const denominatorInverse = this.modInverse(denominator);

        dividedDifferences[i][j] = ((dividedDifferences[i + 1][j - 1] - dividedDifferences[i][j - 1]) * denominatorInverse) % this.prime;
      }
    }

    // Evaluate at x=0
    let result = 0n;
    let term = 1n;

    for (let i = 0; i < n; i++) {
      result = (result + term * dividedDifferences[0][i]) % this.prime;
      if (i < n - 1) {
        const xi = BigInt(points[i].index);
        term = (term * (-xi)) % this.prime;
      }
    }

    return result;
  }

  /**
   * Compute modular inverse using extended Euclidean algorithm
   */
  private modInverse(a: bigint): bigint {
    let m = this.prime;
    let y = 0n;
    let x = 1n;

    if (m === 1n) return 0n;

    while (a > 1n) {
      const q = a / m;
      let t = m;

      m = a % m;
      a = t;
      t = y;

      y = x - q * y;
      x = t;
    }

    if (x < 0n) {
      x += this.prime;
    }

    return x;
  }

  /**
   * Test interpolation with known polynomial
   */
  testInterpolation(): boolean {
    // Test with simple polynomial: f(x) = 2x^2 + 3x + 5
    const points = [
      { x: 1, y: 10n },  // f(1) = 2(1)^2 + 3(1) + 5 = 10
      { x: 2, y: 19n },  // f(2) = 2(4) + 3(2) + 5 = 19
      { x: 3, y: 32n }   // f(3) = 2(9) + 3(3) + 5 = 32
    ];

    // Recover f(0) = 5
    const secret = this.interpolateAt(points, 0);
    return secret === 5n;
  }

  /**
   * Get prime field
   */
  getPrime(): bigint {
    return this.prime;
  }

  /**
   * Set prime field
   */
  setPrime(prime: bigint): void {
    this.prime = prime;
  }

  /**
   * Check if coefficient is valid
   */
  isValidCoefficient(coefficient: number): boolean {
    const coeffBig = BigInt(coefficient);
    return coeffBig >= 0n && coeffBig < this.prime;
  }

  /**
   * Normalize coefficient to field
   */
  normalizeCoefficient(coefficient: number): number {
    const coeffBig = BigInt(coefficient) % this.prime;
    return Number(coeffBig);
  }

  /**
   * Batch normalize coefficients
   */
  normalizeCoefficients(coefficients: number[]): number[] {
    return coefficients.map(c => this.normalizeCoefficient(c));
  }

  /**
   * Compute polynomial degree
   */
  computeDegree(points: { x: number; y: bigint }[]): number {
    // Find minimal degree that fits all points
    // Simplified: assume degree = points.length - 1
    return Math.max(0, points.length - 1);
  }

  /**
   * Check if points are on same polynomial
   */
  pointsConsistent(points: { x: number; y: bigint }[]): boolean {
    if (points.length < 2) return true;

    // For degree-1 (linear) consistency check
    if (points.length === 2) {
      return true; // Any two points define a line
    }

    // For higher degrees, use first few points to predict others
    const testPoints = points.slice(0, 3);
    const remainingPoints = points.slice(3);

    for (const point of remainingPoints) {
      const predictedY = this.interpolateAt(testPoints, point.x);
      if (predictedY !== point.y) {
        return false;
      }
    }

    return true;
  }

  /**
   * Convert coefficients to buffer
   */
  coefficientsToBuffer(coefficients: number[]): Buffer {
    const hexString = coefficients
      .map(c => c.toString(16).padStart(64, '0'))
      .join('');
    return Buffer.from(hexString, 'hex');
  }

  /**
   * Convert buffer to coefficients
   */
  bufferToCoefficients(buffer: Buffer): number[] {
    const hexString = buffer.toString('hex');
    const coefficients: number[] = [];

    for (let i = 0; i < hexString.length; i += 64) {
      const coefficientHex = hexString.slice(i, i + 64);
      coefficients.push(Number(BigInt('0x' + coefficientHex)));
    }

    return coefficients;
  }
}