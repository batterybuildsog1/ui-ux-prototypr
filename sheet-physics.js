/**
 * SheetPhysics - A spring physics system for sheet animations
 * Implements realistic, native-like spring animations for UI elements
 * Based on Bruno Stasse's Silk principles for natural-feeling interactions
 */
class SheetPhysics {
  /**
   * Initialize the spring physics system
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    // Spring physics constants - calibrated for native-like feel
    this.mass = options.mass || 1;
    this.stiffness = options.stiffness || 350;  // Higher = snappier
    this.damping = options.damping || 35;       // Higher = less bouncy
    this.initialVelocity = options.initialVelocity || 0;
    
    // Snap points for sheet positions
    this.snapPoints = options.snapPoints || {
      closed: 0,
      docked: 0.15,  // 15% of screen height
      half: 0.5,     // 50% of screen height
      full: 0.85     // 85% of screen height
    };
    
    // Tracking state
    this.position = 0;
    this.targetPosition = 0;
    this.velocity = this.initialVelocity;
    this.animating = false;
    
    // History for velocity calculation with improved accuracy
    this.positionHistory = [];
    this.timeHistory = [];
    this.maxHistoryLength = 8; // Increased for smoother velocity calculation
    
    // Overshoot behavior for more natural feel
    this.allowOvershoot = options.allowOvershoot !== undefined ? options.allowOvershoot : true;
    this.overshootMultiplier = options.overshootMultiplier || 0.2; // How much overshoot is allowed
    this.distanceThreshold = options.distanceThreshold || 0.1; // When to start applying overshoot
    
    // Callbacks
    this.onUpdate = null;
    this.onComplete = null;
  }
  
  /**
   * Animate to a specific position with physics
   * @param {number} targetPosition - Target position to animate to
   * @param {number|null} initialVelocity - Initial velocity for the animation
   */
  animateTo(targetPosition, initialVelocity = null) {
    if (initialVelocity !== null) {
      this.velocity = initialVelocity;
    }
    
    this.targetPosition = targetPosition;
    
    // Apply overshoot based on the distance and velocity
    if (this.allowOvershoot && Math.abs(this.velocity) > 2) {
      // Only apply overshoot when the velocity is significant
      const distance = Math.abs(this.targetPosition - this.position);
      if (distance > this.distanceThreshold) {
        // Calculate overshoot effect
        const overshootAmount = Math.min(0.1, Math.abs(this.velocity) * this.overshootMultiplier);
        const direction = Math.sign(this.velocity);
        
        // Apply overshoot in the direction of movement
        this.targetPosition += overshootAmount * direction;
        
        // Clamp to valid range (0-1)
        this.targetPosition = Math.max(0, Math.min(1, this.targetPosition));
      }
    }
    
    if (!this.animating) {
      this.animating = true;
      this.lastFrameTime = performance.now();
      requestAnimationFrame(this.animationFrame.bind(this));
    }
  }
  
  /**
   * Animation loop using requestAnimationFrame with improved timing
   */
  animationFrame(timestamp) {
    // Calculate delta time (clamped to avoid large jumps)
    const deltaTime = Math.min(0.064, (timestamp - this.lastFrameTime) / 1000);
    this.lastFrameTime = timestamp;
    
    // Calculate spring force
    const displacement = this.targetPosition - this.position;
    const springForce = displacement * this.stiffness;
    
    // Calculate damping force with improved non-linear damping for more natural feel
    const velocitySquared = this.velocity * Math.abs(this.velocity);
    const dampingForce = velocitySquared > 0 
      ? this.velocity * (this.damping + Math.abs(this.velocity) * 0.05) 
      : this.velocity * this.damping;
    
    // Calculate acceleration (F = ma)
    const acceleration = (springForce - dampingForce) / this.mass;
    
    // Update velocity with improved accuracy at low values
    this.velocity += acceleration * deltaTime;
    
    // Apply velocity threshold to prevent tiny movements
    if (Math.abs(this.velocity) < 0.001 && Math.abs(displacement) < 0.001) {
      this.velocity = 0;
    }
    
    // Update position
    this.position += this.velocity * deltaTime;
    
    // Notify position update
    if (this.onUpdate) {
      this.onUpdate(this.position);
    }
    
    // Continue animation until settled with improved completion criteria
    if (Math.abs(this.velocity) > 0.01 || Math.abs(displacement) > 0.001) {
      requestAnimationFrame(this.animationFrame.bind(this));
    } else {
      // Snap precisely to a snap point if very close
      const nearestSnapPoint = this.findNearestSnapPoint(this.position);
      if (Math.abs(this.position - nearestSnapPoint) < 0.01) {
        this.position = nearestSnapPoint;
      } else {
        // Otherwise snap to target (might be an overshoot value)
        this.position = this.targetPosition;
      }
      
      this.velocity = 0;
      this.animating = false;
      
      if (this.onUpdate) {
        this.onUpdate(this.position);
      }
      
      if (this.onComplete) {
        this.onComplete();
      }
    }
  }
  
  /**
   * Find the nearest snap point value
   * @param {number} position - Current position
   * @returns {number} - Nearest snap point value
   */
  findNearestSnapPoint(position) {
    const snapValues = Object.values(this.snapPoints);
    return snapValues.reduce((prev, curr) => 
      Math.abs(curr - position) < Math.abs(prev - position) ? curr : prev
    );
  }
  
  /**
   * Update position from drag gesture with improved tracking
   * @param {number} dragPosition - New position from drag
   */
  updatePositionFromDrag(dragPosition) {
    // Add to position history for velocity calculation
    const now = performance.now();
    this.positionHistory.push(dragPosition);
    this.timeHistory.push(now);
    
    // Trim history to max length
    if (this.positionHistory.length > this.maxHistoryLength) {
      this.positionHistory.shift();
      this.timeHistory.shift();
    }
    
    // Update position
    this.position = dragPosition;
    
    if (this.onUpdate) {
      this.onUpdate(this.position);
    }
  }
  
  /**
   * Calculate velocity from position history with improved algorithm
   * @returns {number} Calculated velocity
   */
  calculateVelocity() {
    if (this.positionHistory.length < 2) {
      return 0;
    }
    
    // Calculate weighted average velocity using multiple points
    // This produces smoother transitions and better prediction
    const velocities = [];
    const weights = [];
    
    // Calculate velocities between consecutive points
    for (let i = 1; i < this.positionHistory.length; i++) {
      const positionDelta = this.positionHistory[i] - this.positionHistory[i-1];
      const timeDelta = (this.timeHistory[i] - this.timeHistory[i-1]) / 1000;
      
      if (timeDelta > 0) {
        // Calculate velocity between these two points
        const velocity = positionDelta / timeDelta;
        
        // More recent velocities get higher weights
        const weight = Math.pow(i / (this.positionHistory.length - 1), 2);
        
        velocities.push(velocity);
        weights.push(weight);
      }
    }
    
    // Calculate weighted average
    if (velocities.length === 0) return 0;
    
    let totalVelocity = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < velocities.length; i++) {
      totalVelocity += velocities[i] * weights[i];
      totalWeight += weights[i];
    }
    
    return totalWeight > 0 ? totalVelocity / totalWeight : 0;
  }
  
  /**
   * Complete position change based on velocity with more intelligent snap behavior
   * @param {number} [velocityOverride] - Optional velocity override
   */
  completePositionChange(velocityOverride) {
    // Calculate velocity from history
    if (velocityOverride !== undefined) {
      this.velocity = velocityOverride;
    } else {
      this.velocity = this.calculateVelocity();
    }
    
    // Apply velocity multiplier for more responsive feel
    const velocityMultiplier = 1.2;
    this.velocity *= velocityMultiplier;
    
    // Clear history
    this.positionHistory = [];
    this.timeHistory = [];
    
    // Get available snap points
    const snapValues = Object.values(this.snapPoints);
    const snapEntries = Object.entries(this.snapPoints);
    
    // Sort by distance to current position
    const sortedByDistance = [...snapEntries].sort((a, b) => 
      Math.abs(a[1] - this.position) - Math.abs(b[1] - this.position)
    );
    
    // Get closest snap point
    const closest = sortedByDistance[0][1];
    const closestName = sortedByDistance[0][0];
    
    // Determine target based on velocity, position, and distance
    let targetPosition = closest;
    let targetName = closestName;
    
    // Only consider velocity if it's significant
    const velocityThreshold = 0.5;
    const moveThreshold = 0.1; // Minimum distance to consider a move to next snap point
    
    if (Math.abs(this.velocity) > velocityThreshold) {
      // Sort snap points by position for direction-based logic
      const sortedByPosition = [...snapEntries].sort((a, b) => a[1] - b[1]);
      
      // Find current index
      const currentIndex = sortedByPosition.findIndex(entry => entry[0] === closestName);
      
      // Determine direction based on velocity
      const direction = Math.sign(this.velocity);
      
      if (direction > 0 && currentIndex < sortedByPosition.length - 1) {
        // Moving up, check if velocity is enough to go to next snap point
        const nextPosition = sortedByPosition[currentIndex + 1][1];
        const distance = nextPosition - this.position;
        
        if (distance > 0 && (Math.abs(this.velocity) > velocityThreshold * (1 + distance * 2) || distance < moveThreshold)) {
          targetPosition = nextPosition;
          targetName = sortedByPosition[currentIndex + 1][0];
        }
      } else if (direction < 0 && currentIndex > 0) {
        // Moving down, check if velocity is enough to go to previous snap point
        const prevPosition = sortedByPosition[currentIndex - 1][1];
        const distance = this.position - prevPosition;
        
        if (distance > 0 && (Math.abs(this.velocity) > velocityThreshold * (1 + distance * 2) || distance < moveThreshold)) {
          targetPosition = prevPosition;
          targetName = sortedByPosition[currentIndex - 1][0];
        }
      }
    }
    
    // Animate to target position
    this.animateTo(targetPosition, this.velocity);
    
    // Return the name of the target position for event handling
    return targetName;
  }
  
  /**
   * Get position name from value with improved tolerance
   * @param {number} position - Position value
   * @returns {string|null} - Position name or null if not found
   */
  getPositionName(position) {
    // Dynamic tolerance based on position to better handle snap points
    const tolerance = 0.02;
    
    for (const [name, value] of Object.entries(this.snapPoints)) {
      if (Math.abs(position - value) < tolerance) {
        return name;
      }
    }
    return null;
  }
}
