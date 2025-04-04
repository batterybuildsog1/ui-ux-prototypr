/**
 * SheetController - Manages the sheet UI and integrates with the physics system
 * Creates a native-like sheet experience with gesture handling
 * Based on Bruno Stasse's Silk design principles for fluid interactions
 */
class SheetController {
  /**
   * Initialize the sheet controller
   * @param {HTMLElement} container - Container element for the sheet
   * @param {Object} options - Configuration options
   */
  constructor(container, options = {}) {
    this.container = container;
    
    // Create sheet element
    this.sheetElement = document.createElement('div');
    this.sheetElement.className = 'silk-sheet';
    
    // Create handle element with improved design
    this.handleElement = document.createElement('div');
    this.handleElement.className = 'silk-sheet-handle';
    
    // Create content container
    this.contentElement = document.createElement('div');
    this.contentElement.className = 'silk-sheet-content';
    
    // Assemble sheet
    this.sheetElement.appendChild(this.handleElement);
    this.sheetElement.appendChild(this.contentElement);
    this.container.appendChild(this.sheetElement);
    
    // Initialize physics with improved config for natural feel
    const physicsOptions = {
      snapPoints: options.snapPoints || {
        closed: 0,
        docked: 0.15,
        half: 0.5,
        full: 0.85
      },
      mass: options.mass || 1,
      stiffness: options.stiffness || 350,
      damping: options.damping || 35,
      allowOvershoot: options.allowOvershoot !== undefined ? options.allowOvershoot : true,
      overshootMultiplier: options.overshootMultiplier || 0.2
    };
    
    this.physics = new SheetPhysics(physicsOptions);
    this.physics.onUpdate = this.updateSheetPosition.bind(this);
    this.physics.onComplete = this.handleAnimationComplete.bind(this);
    
    // Get initial viewport height
    this.viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

    // Set initial position
    this.currentPosition = options.initialPosition || 'closed';
    
    // Track dragging state for UI feedback
    this.isDragging = false;
    
    // Callbacks
    this.onPositionChangeCallbacks = [];
    this.onTransitionStartCallbacks = [];
    this.onTransitionEndCallbacks = [];
    this.onDragStartCallbacks = [];
    this.onDragEndCallbacks = [];
    
    // Track touch points for multi-touch handling
    this.activeTouches = new Map();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Set initial position with a longer delay to ensure rendering
    setTimeout(() => {
      console.log("Setting initial sheet position to:", this.currentPosition);
      this.setPosition(this.currentPosition, false);
    }, 200);
  }
  
  /**
   * Set up event listeners for gesture handling with improved touch tracking
   */
  setupEventListeners() {
    // Track touch/pointer events
    let startY = 0;
    let currentY = 0;
    let startPosition = 0;
    let isDragging = false;
    let pointerId = null;
    let startTimestamp = 0;
    
    // Improved pointer handling
    const onPointerDown = (e) => {
      // Allow drag initiation if:
      // 1. The target is part of the sheet OR
      // 2. The sheet is closed/docked (allowing background swipe-up)
      const canInitiateDrag = this.isPartOfSheet(e.target) ||
                              ['closed', 'docked'].includes(this.currentPosition);

      if (!canInitiateDrag) return;

      // Only capture the first pointer for dragging
      if (isDragging) return;
      
      startY = e.clientY;
      currentY = e.clientY;
      startPosition = this.physics.position;
      isDragging = true;
      this.isDragging = true;
      pointerId = e.pointerId;
      startTimestamp = performance.now();
      
      // Add class for visual feedback
      this.sheetElement.classList.add('dragging');
      
      // Capture pointer for events outside element
      this.sheetElement.setPointerCapture(e.pointerId);
      
      // Notify transition and drag start
      this.notifyTransitionStart();
      this.notifyDragStart();
      
      e.preventDefault();
    };
    
    const onPointerMove = (e) => {
      // Only handle the captured pointer
      if (!isDragging || e.pointerId !== pointerId) return;
      
      currentY = e.clientY;
      const deltaY = currentY - startY;
      
      // Convert delta to position value (percentage of screen height)
      // Use visualViewport height for accuracy on mobile
      const currentViewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const deltaPosition = deltaY / currentViewportHeight;
      let newPosition = startPosition - deltaPosition;

      // Apply resistance when dragging beyond limits
      if (newPosition < 0) {
        // Resistance when dragging below minimum
        newPosition = newPosition * 0.3;
      } else if (newPosition > 0.95) {
        // Resistance when dragging above maximum
        const overshoot = newPosition - 0.95;
        newPosition = 0.95 + overshoot * 0.3;
      }
      
      // Update sheet position
      this.physics.updatePositionFromDrag(newPosition);
      
      e.preventDefault();
    };
    
    const onPointerUp = (e) => {
      // Only handle the captured pointer
      if (!isDragging || e.pointerId !== pointerId) return;
      
      isDragging = false;
      this.isDragging = false;
      
      // Remove dragging class
      this.sheetElement.classList.remove('dragging');
      
      // Calculate velocity (positive = upward)
      const velocity = this.physics.calculateVelocity();
      
      // Complete position change with velocity
      const targetPosition = this.physics.completePositionChange(velocity);
      
      // Release pointer capture
      this.sheetElement.releasePointerCapture(e.pointerId);
      
      // Notify drag end
      this.notifyDragEnd(targetPosition);
      
      e.preventDefault();
    };
    
    const onPointerCancel = (e) => {
      // Only handle the captured pointer
      if (!isDragging || e.pointerId !== pointerId) return;
      
      isDragging = false;
      this.isDragging = false;
      
      // Remove dragging class
      this.sheetElement.classList.remove('dragging');
      
      // Release pointer capture
      this.sheetElement.releasePointerCapture(e.pointerId);
      
      // Snap back to nearest position
      this.physics.completePositionChange(0);
      
      // Notify drag end
      this.notifyDragEnd();
      
      e.preventDefault();
    };
    
    // Add event listeners with passive: false for better performance
    this.sheetElement.addEventListener('pointerdown', onPointerDown, { passive: false });
    this.sheetElement.addEventListener('pointermove', onPointerMove, { passive: false });
    this.sheetElement.addEventListener('pointerup', onPointerUp, { passive: false });
    this.sheetElement.addEventListener('pointercancel', onPointerCancel, { passive: false });
    
    // Prevent default touch actions to avoid scrolling conflicts, but allow input focus
    // Further refined based on feedback for browser clicks and input focus
    this.sheetElement.addEventListener('touchstart', e => {
      const targetElement = e.target;

      // Check if the target is an interactive element within the sheet content
      const isInteractiveContent = targetElement.closest('.silk-sheet-content') && (
        targetElement.tagName === 'INPUT' ||
        targetElement.tagName === 'TEXTAREA' ||
        targetElement.tagName === 'SELECT' ||
        targetElement.tagName === 'BUTTON' ||
        targetElement.tagName === 'A' ||
        targetElement.closest('label') // Allow taps on labels associated with inputs/radios/checkboxes
      );

      if (isInteractiveContent) {
        // Don't prevent default for interactive elements inside the content area.
        // Allows focusing inputs, clicking buttons/labels, etc.
        return;
      }

      // Prevent default only if the touch starts on the handle or the sheet background itself,
      // indicating an intent to drag the sheet.
      if (targetElement === this.handleElement || targetElement === this.sheetElement) {
         e.preventDefault();
      }
      // Otherwise, allow default (might be scrolling within content if not handled below, etc.)

    }, { passive: false });

    // Handle content scrolling with improved logic
    this.contentElement.addEventListener('touchstart', e => {
      // Allow scrolling in content area when sheet is expanded
      if (this.currentPosition === 'full' || this.currentPosition === 'half') {
        // Check if we're at the top or bottom of the scroll area
        const isAtTop = this.contentElement.scrollTop === 0;
        const isAtBottom = this.contentElement.scrollTop + this.contentElement.clientHeight >= this.contentElement.scrollHeight - 1;
        
        // Only prevent default at boundaries and when scrolling in the sheet direction
        if ((isAtTop && e.touches[0].clientY < startY) || (isAtBottom && e.touches[0].clientY > startY)) {
          e.preventDefault();
        } else {
          e.stopPropagation();
        }
      }
    }, { passive: false });
    
    // Add keyboard navigation for accessibility
    document.addEventListener('keydown', e => {
      if (this.currentPosition !== 'closed') {
        if (e.key === 'Escape') {
          // Close sheet on escape
          this.setPosition('closed');
          e.preventDefault();
        } else if (e.key === 'ArrowDown' && e.altKey) {
          // Move sheet down on Alt+ArrowDown
          const positions = Object.keys(this.physics.snapPoints);
          const currentIndex = positions.indexOf(this.currentPosition);
          
          if (currentIndex > 0) {
            this.setPosition(positions[currentIndex - 1]);
            e.preventDefault();
          }
        } else if (e.key === 'ArrowUp' && e.altKey) {
          // Move sheet up on Alt+ArrowUp
          const positions = Object.keys(this.physics.snapPoints);
          const currentIndex = positions.indexOf(this.currentPosition);
          
          if (currentIndex < positions.length - 1) {
            this.setPosition(positions[currentIndex + 1]);
            e.preventDefault();
          }
        }
      }
    });
    
    // Handle window resize
    window.addEventListener('resize', this.handleResize.bind(this));

    // Listen for visual viewport resize events (e.g., keyboard)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.handleResize.bind(this));
    }
  }

  /**
   * Handle window or visual viewport resize
   */
  handleResize() {
    this.viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    // Update sheet position based on the new viewport height
    this.updateSheetPosition(this.physics.position);
  }
  
  /**
   * Update sheet position based on physics
   * @param {number} position - New position value
   */
  updateSheetPosition(position) {
    // Calculate translation based on position using potentially updated viewport height
    const translateY = this.viewportHeight * (1 - position);
    console.log("Position:", position, "TranslateY:", translateY, "Viewport:", this.viewportHeight); // Added log

    // Apply transform with will-change for performance
    const isDesktop = window.innerWidth >= 992;
    
    // Set a data attribute for position for responsive styling
    const positionName = this.physics.getPositionName(position);
    if (positionName) {
      this.sheetElement.dataset.position = positionName;
    }
    
    // Apply appropriate transform for desktop or mobile layout
    if (isDesktop) {
      this.sheetElement.style.transform = `translateX(-50%) translateY(${translateY}px)`;
    } else {
      this.sheetElement.style.transform = `translateY(${translateY}px)`;
    }
    
    // Update current named position if we're at a snap point
    if (positionName && this.currentPosition !== positionName) {
      this.currentPosition = positionName;
      this.notifyPositionChange();
    }
  }
  
  /**
   * Set sheet to a specific position
   * @param {string} positionName - Name of the position (docked, half, full, closed)
   * @param {boolean} animated - Whether to animate the transition
   */
  setPosition(positionName, animated = true) {
    const position = this.getPositionValue(positionName);
    
    if (animated) {
      this.notifyTransitionStart();
      this.physics.animateTo(position);
    } else {
      this.physics.position = position;
      this.updateSheetPosition(position);
    }
    
    this.currentPosition = positionName;
    this.sheetElement.dataset.position = positionName;
  }
  
  /**
   * Get position value from name
   * @param {string} positionName - Position name
   * @returns {number} Position value
   */
  getPositionValue(positionName) {
    return this.physics.snapPoints[positionName] || 0;
  }
  
  /**
   * Check if an element is part of the sheet
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if element is part of sheet
   */
  isPartOfSheet(element) {
    let current = element;
    while (current) {
      if (current === this.sheetElement) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }
  
  /**
   * Set content of the sheet with improved state preservation
   * @param {string|HTMLElement} content - Content to set
   */
  setContent(content) {
    // First, save scroll position if there is one
    const scrollTop = this.contentElement.scrollTop;
    
    // Apply fade-out transition to current content
    this.contentElement.style.opacity = '0';
    this.contentElement.style.transition = 'opacity 0.15s ease-out';
    
    // Set new content after brief transition
    setTimeout(() => {
      // Set content
      if (typeof content === 'string') {
        this.contentElement.innerHTML = content;
      } else if (content instanceof Node) {
        this.contentElement.innerHTML = '';
        this.contentElement.appendChild(content);
      }
      
      // Reset scroll position
      this.contentElement.scrollTop = scrollTop;
      
      // Fade in new content
      this.contentElement.style.opacity = '1';
      
      // Set up focus management for forms
      const firstInput = this.contentElement.querySelector('input, button, select, textarea');
      if (firstInput && this.currentPosition === 'half' || this.currentPosition === 'full') {
        // Allow a brief delay for rendering
        setTimeout(() => {
          firstInput.focus();
        }, 300);
      }
    }, 150);
  }
  
  /**
   * Handle animation completion
   */
  handleAnimationComplete() {
    this.notifyTransitionEnd();
  }
  
  /**
   * Add position change callback
   * @param {Function} callback - Callback function
   */
  onPositionChange(callback) {
    this.onPositionChangeCallbacks.push(callback);
    return this; // Enable chaining
  }
  
  /**
   * Add transition start callback
   * @param {Function} callback - Callback function
   */
  onTransitionStart(callback) {
    this.onTransitionStartCallbacks.push(callback);
    return this; // Enable chaining
  }
  
  /**
   * Add transition end callback
   * @param {Function} callback - Callback function
   */
  onTransitionEnd(callback) {
    this.onTransitionEndCallbacks.push(callback);
    return this; // Enable chaining
  }
  
  /**
   * Add drag start callback
   * @param {Function} callback - Callback function
   */
  onDragStart(callback) {
    this.onDragStartCallbacks.push(callback);
    return this; // Enable chaining
  }
  
  /**
   * Add drag end callback
   * @param {Function} callback - Callback function
   */
  onDragEnd(callback) {
    this.onDragEndCallbacks.push(callback);
    return this; // Enable chaining
  }
  
  /**
   * Notify all position change callbacks
   */
  notifyPositionChange() {
    this.onPositionChangeCallbacks.forEach(callback => {
      callback(this.currentPosition);
    });
  }
  
  /**
   * Notify all transition start callbacks
   */
  notifyTransitionStart() {
    this.onTransitionStartCallbacks.forEach(callback => {
      callback();
    });
  }
  
  /**
   * Notify all transition end callbacks
   */
  notifyTransitionEnd() {
    this.onTransitionEndCallbacks.forEach(callback => {
      callback();
    });
  }
  
  /**
   * Notify all drag start callbacks
   */
  notifyDragStart() {
    this.onDragStartCallbacks.forEach(callback => {
      callback();
    });
  }
  
  /**
   * Notify all drag end callbacks
   * @param {string} targetPosition - Target position name
   */
  notifyDragEnd(targetPosition) {
    this.onDragEndCallbacks.forEach(callback => {
      callback(targetPosition);
    });
  }
  
  /**
   * Get the sheet element
   * @returns {HTMLElement} Sheet element
   */
  getElement() {
    return this.sheetElement;
  }
  
  /**
   * Get the handle element
   * @returns {HTMLElement} Handle element
   */
  getHandleElement() {
    return this.handleElement;
  }
  
  /**
   * Get the content element
   * @returns {HTMLElement} Content element
   */
  getContentElement() {
    return this.contentElement;
  }
  
  /**
   * Get current position
   * @returns {string} Current position name
   */
  getPosition() {
    return this.currentPosition;
  }
  
  /**
   * Check if sheet is being dragged
   * @returns {boolean} True if sheet is being dragged
   */
  isDraggingSheet() {
    return this.isDragging;
  }
}
