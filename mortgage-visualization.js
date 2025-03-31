/**
 * MortgageVisualization - Creates an interactive 3D visualization for mortgage data
 * Implements Bruno Stasse's principles for fluid animations and progressive disclosure
 */
class MortgageVisualization {
  /**
   * Initialize the 3D visualization
   * @param {HTMLCanvasElement} canvas - Canvas element for Three.js rendering
   * @param {HTMLElement} overlay - Overlay element for initial messaging
   */
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.dataSource = null;
    
    // Scene state
    this.initialized = false;
    this.animating = false;
    this.interactionEnabled = false;
    this.currentMode = 'house'; // 'house', 'dti', 'affordability'
    
    // Current data values for visualization
    this.currentData = {
      targetHomePrice: 250000,
      downPayment: 50000,
      downPaymentPercent: 20,
      monthlyIncome: 5000,
      dti: 36,
      maxDti: 43,
      maxMonthlyPayment: 1500,
      houseSize: 1 // Scale factor for house size (1 = default)
    };
    
    // Objects for animation
    this.objects = {
      house: null,
      roof: null,
      ground: null,
      dtiBar: null,
      maxDtiBar: null,
      debtPie: null,
      incomePie: null
    };
    
    // Tooltip and info elements
    this.tooltip = null;
    this.infoPanel = null;
    this.controlsPanel = null;
    
    // Create Three.js scene
    this.initScene();
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  /**
   * Initialize the Three.js scene
   */
  initScene() {
    // Create scene, camera, and renderer
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      40, // Field of view
      window.innerWidth / window.innerHeight, // Aspect ratio
      0.1, // Near clipping plane
      1000 // Far clipping plane
    );
    
    // Add a subtle fog for depth
    this.scene.fog = new THREE.FogExp2(0x788BFF, 0.03);
    
    // Set camera position
    this.camera.position.set(0, 3, 8);
    this.camera.lookAt(0, 0, 0);
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    
    // Create ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    
    // Create directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(5, 10, 5);
    sunLight.castShadow = true;
    sunLight.shadow.camera.far = 20;
    sunLight.shadow.mapSize.set(2048, 2048);
    this.scene.add(sunLight);
    
    // Add soft light from the other side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);
    
    // Create ground plane
    this.addGround();
    
    // Create house visualization
    this.addHouse();
    
    // Create DTI visualization (initially hidden)
    this.addDtiVisualization();
    
    // Add info panel
    this.addInfoPanel();
    
    // Add tooltip
    this.addTooltip();
    
    // Add control buttons
    this.addControls();
    
    // Set initial scene state
    this.setVisualizationMode('house');
    
    // Mark as initialized
    this.initialized = true;
    
    // Start animation loop
    this.animate();
  }
  
  /**
   * Add ground plane to the scene
   */
  addGround() {
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x7ec850,
      roughness: 0.8,
      metalness: 0.1
    });
    this.objects.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.objects.ground.rotation.x = -Math.PI / 2;
    this.objects.ground.position.y = -1;
    this.objects.ground.receiveShadow = true;
    this.scene.add(this.objects.ground);
  }
  
  /**
   * Add house model to the scene with more details
   */
  addHouse() {
    // Create house body
    const houseWidth = 3;
    const houseHeight = 2;
    const houseDepth = 4;
    
    // Create house group to hold all parts
    this.houseGroup = new THREE.Group();
    this.scene.add(this.houseGroup);
    
    const houseGeometry = new THREE.BoxGeometry(houseWidth, houseHeight, houseDepth);
    const houseMaterial = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.7,
      metalness: 0.1
    });
    this.objects.house = new THREE.Mesh(houseGeometry, houseMaterial);
    this.objects.house.position.y = houseHeight / 2 - 0.5;
    this.objects.house.castShadow = true;
    this.objects.house.receiveShadow = true;
    this.objects.house.userData = { type: 'house' };
    this.scene.add(this.objects.house);
    
    // Create roof
    const roofHeight = 1.2;
    const roofGeometry = new THREE.ConeGeometry(
      Math.sqrt(Math.pow(houseWidth, 2) + Math.pow(houseDepth, 2)) / 2,
      roofHeight,
      4
    );
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0xd35400,
      roughness: 0.7,
      metalness: 0.1
    });
    this.objects.roof = new THREE.Mesh(roofGeometry, roofMaterial);
    this.objects.roof.position.y = houseHeight + roofHeight / 2 - 0.5;
    this.objects.roof.rotation.y = Math.PI / 4;
    this.objects.roof.castShadow = true;
    this.objects.roof.userData = { type: 'roof' };
    this.scene.add(this.objects.roof);
    
    // Add door
    const doorWidth = 0.8;
    const doorHeight = 1.4;
    const doorGeometry = new THREE.PlaneGeometry(doorWidth, doorHeight);
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a235a,
      roughness: 0.7,
      metalness: 0.2
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.z = houseDepth / 2 + 0.01;
    door.position.y = doorHeight / 2 - 0.5;
    this.objects.house.add(door);
    
    // Add windows
    const windowSize = 0.6;
    const windowGeometry = new THREE.PlaneGeometry(windowSize, windowSize);
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x5dade2,
      roughness: 0.3,
      metalness: 0.3
    });
    
    // Front windows
    const frontWindow1 = new THREE.Mesh(windowGeometry, windowMaterial);
    frontWindow1.position.set(-1, 0.5, houseDepth / 2 + 0.01);
    this.objects.house.add(frontWindow1);
    
    const frontWindow2 = new THREE.Mesh(windowGeometry, windowMaterial);
    frontWindow2.position.set(1, 0.5, houseDepth / 2 + 0.01);
    this.objects.house.add(frontWindow2);
    
    // Side windows
    const sideWindow1 = new THREE.Mesh(windowGeometry, windowMaterial);
    sideWindow1.position.set(houseWidth / 2 + 0.01, 0.5, 1);
    sideWindow1.rotation.y = Math.PI / 2;
    this.objects.house.add(sideWindow1);
    
    const sideWindow2 = new THREE.Mesh(windowGeometry, windowMaterial);
    sideWindow2.position.set(houseWidth / 2 + 0.01, 0.5, -1);
    sideWindow2.rotation.y = Math.PI / 2;
    this.objects.house.add(sideWindow2);
    
    // Set initial scale (will be updated based on data)
    this.updateHouseScale();
  }
  
  /**
   * Add DTI visualization elements to the scene
   */
  addDtiVisualization() {
    // Create group for DTI visualization
    this.dtiGroup = new THREE.Group();
    this.dtiGroup.position.y = 0.01; // Just above ground
    this.dtiGroup.visible = false;
    this.scene.add(this.dtiGroup);
    
    // Create bars for DTI visualization
    const barWidth = 0.8;
    const maxHeight = 5;
    
    // Current DTI bar
    const dtiBarGeometry = new THREE.BoxGeometry(barWidth, 1, barWidth);
    const dtiBarMaterial = new THREE.MeshStandardMaterial({
      color: 0x3498db,
      roughness: 0.3,
      metalness: 0.5
    });
    this.objects.dtiBar = new THREE.Mesh(dtiBarGeometry, dtiBarMaterial);
    this.objects.dtiBar.position.x = -1;
    this.objects.dtiBar.position.y = 0.5; // Half height
    this.objects.dtiBar.castShadow = true;
    this.objects.dtiBar.userData = { type: 'dtiBar', value: this.currentData.dti };
    this.dtiGroup.add(this.objects.dtiBar);
    
    // Max DTI bar
    const maxDtiBarGeometry = new THREE.BoxGeometry(barWidth, 1, barWidth);
    const maxDtiBarMaterial = new THREE.MeshStandardMaterial({
      color: 0xe74c3c,
      roughness: 0.3,
      metalness: 0.5
    });
    this.objects.maxDtiBar = new THREE.Mesh(maxDtiBarGeometry, maxDtiBarMaterial);
    this.objects.maxDtiBar.position.x = 1;
    this.objects.maxDtiBar.position.y = 0.5; // Half height
    this.objects.maxDtiBar.castShadow = true;
    this.objects.maxDtiBar.userData = { type: 'maxDtiBar', value: this.currentData.maxDti };
    this.dtiGroup.add(this.objects.maxDtiBar);
    
    // Create bar labels
    const dtiLabelEl = document.createElement('div');
    dtiLabelEl.className = 'data-label';
    dtiLabelEl.textContent = `Current DTI: ${this.currentData.dti}%`;
    document.querySelector('.visualization-container').appendChild(dtiLabelEl);
    this.dtiLabel = dtiLabelEl;
    this.dtiLabel.style.opacity = '0';
    
    const maxDtiLabelEl = document.createElement('div');
    maxDtiLabelEl.className = 'data-label';
    maxDtiLabelEl.textContent = `Max DTI: ${this.currentData.maxDti}%`;
    document.querySelector('.visualization-container').appendChild(maxDtiLabelEl);
    this.maxDtiLabel = maxDtiLabelEl;
    this.maxDtiLabel.style.opacity = '0';
    
    // Update bar heights based on data
    this.updateDtiVisualization();
  }
  
  /**
   * Add tooltip element for interactive data display
   */
  addTooltip() {
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'visualization-tooltip';
    document.querySelector('.visualization-container').appendChild(tooltipEl);
    this.tooltip = tooltipEl;
  }
  
  /**
   * Add info panel for visualization data
   */
  addInfoPanel() {
    const infoPanelEl = document.createElement('div');
    infoPanelEl.className = 'visualization-info-panel';
    infoPanelEl.innerHTML = `
      <h3>Mortgage Visualization</h3>
      <p>House Price: <span id="info-house-price">$250,000</span></p>
      <p>Down Payment: <span id="info-down-payment">$50,000 (20%)</span></p>
      <p>Monthly Income: <span id="info-monthly-income">$5,000</span></p>
      <div class="visualization-legend">
        <div class="legend-item">
          <div class="legend-color" style="background-color: #3498db;"></div>
          <span>Current DTI</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #e74c3c;"></div>
          <span>Maximum DTI</span>
        </div>
      </div>
    `;
    document.querySelector('.visualization-container').appendChild(infoPanelEl);
    this.infoPanel = infoPanelEl;
  }
  
  /**
   * Add control buttons for visualization modes
   */
  addControls() {
    const controlsEl = document.createElement('div');
    controlsEl.className = 'visualization-controls';
    controlsEl.innerHTML = `
      <button class="visualization-control-button" data-mode="house" title="House View">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </button>
      <button class="visualization-control-button" data-mode="dti" title="DTI Comparison">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="18" y="3" width="4" height="18"></rect>
          <rect x="10" y="8" width="4" height="13"></rect>
          <rect x="2" y="13" width="4" height="8"></rect>
        </svg>
      </button>
      <button class="visualization-control-button" data-mode="affordability" title="Affordability Analysis">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
          <line x1="12" y1="6" x2="12" y2="8"></line>
          <line x1="12" y1="16" x2="12" y2="18"></line>
        </svg>
      </button>
    `;
    document.querySelector('.visualization-container').appendChild(controlsEl);
    this.controlsPanel = controlsEl;
  }
  
  /**
   * Set up event listeners for enhanced interactions
   */
  setupEventListeners() {
    // Resize handler
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // Mode switch controls
    document.querySelectorAll('.visualization-control-button').forEach(button => {
      button.addEventListener('click', () => {
        const mode = button.getAttribute('data-mode');
        this.setVisualizationMode(mode);
      });
    });
    
    // Mouse move for interactive elements
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    
    // Click for object selection
    this.canvas.addEventListener('click', this.handleClick.bind(this));
    
    // Touch events for mobile with gesture support
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    
    // Gesture state tracking
    this.gestureState = {
      // Single touch/drag
      dragging: false,
      selectedObject: null,
      isDraggable: false,
      dragStartPosition: { x: 0, y: 0 },
      objectStartPosition: { x: 0, y: 0, z: 0 },
      objectStartRotation: { x: 0, y: 0, z: 0 },
      
      // Multi-touch gestures
      isMultiTouch: false,
      startDistance: 0,
      startScale: 1,
      startAngle: 0,
      touches: [],
      
      // Last interaction time for double-tap detection
      lastTapTime: 0,
      
      // Animation state
      isAnimating: false
    };
    
    // Add a key event listener for debug and accessibility
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
  }
  
  /**
   * Handle window resize
   */
  handleResize() {
    // Update camera
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    
    // Update renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Update label positions
    this.updateLabelPositions();
  }
  
  /**
   * Handle mouse move for interactive elements
   * @param {MouseEvent} event - Mouse event
   */
  handleMouseMove(event) {
    if (!this.interactionEnabled) return;
    
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = this.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Check for intersections
    const intersects = this.getIntersects(x, y);
    if (intersects.length > 0) {
      const object = intersects[0].object;
      this.handleObjectHover(object, event.clientX, event.clientY);
    } else {
      this.clearTooltip();
    }
  }
  
  /**
   * Handle click on objects
   * @param {MouseEvent} event - Mouse event
   */
  handleClick(event) {
    if (!this.interactionEnabled) return;
    
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = this.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Check for intersections
    const intersects = this.getIntersects(x, y);
    if (intersects.length > 0) {
      const object = intersects[0].object;
      this.handleObjectClick(object);
    }
  }
  
  /**
   * Handle touch start with enhanced gesture detection
   * @param {TouchEvent} event - Touch event
   */
  handleTouchStart(event) {
    // Only prevent default if we're handling this touch
    if (this.interactionEnabled && !this.gestureState.isAnimating) {
      event.preventDefault();
      
      // Capture touch points
      const touches = event.touches;
      
      // Reset gesture state
      this.gestureState.touches = [];
      for (let i = 0; i < touches.length; i++) {
        this.gestureState.touches.push({
          id: touches[i].identifier,
          x: touches[i].clientX,
          y: touches[i].clientY
        });
      }
      
      // Check for single-touch or multi-touch
      if (touches.length === 1) {
        // Single touch logic
        const touch = touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Store touch position for drag detection
        this.gestureState.dragStartPosition = { x: touch.clientX, y: touch.clientY };
        
        // Check for double-tap
        const now = Date.now();
        if (now - this.gestureState.lastTapTime < 300) {
          // Double tap detected
          this.handleDoubleTap(x, y);
          this.gestureState.lastTapTime = 0; // Reset to prevent triple-tap
        } else {
          this.gestureState.lastTapTime = now;
          
          // Check for intersections with 3D objects
          const intersects = this.getIntersects(x, y);
          if (intersects.length > 0) {
            const object = intersects[0].object;
            this.hoveredObject = object;
            
            // Check if object is draggable
            if (this.isObjectDraggable(object)) {
              // Show visual feedback that object can be dragged
              this.showDragIndicator(object);
              
              // Store selected object for dragging
              this.gestureState.selectedObject = object;
              this.gestureState.isDraggable = true;
              
              // Store original position
              this.gestureState.objectStartPosition = {
                x: object.position.x,
                y: object.position.y,
                z: object.position.z
              };
              
              // Store original rotation
              this.gestureState.objectStartRotation = {
                x: object.rotation.x,
                y: object.rotation.y,
                z: object.rotation.z
              };
              
              // Store intersection point for accurate dragging
              this.gestureState.intersectionPoint = intersects[0].point;
            }
          }
        }
      } else if (touches.length === 2) {
        // Multi-touch gesture start
        this.gestureState.isMultiTouch = true;
        
        // Calculate initial distance and angle for pinch/rotate
        const dx = touches[1].clientX - touches[0].clientX;
        const dy = touches[1].clientY - touches[0].clientY;
        this.gestureState.startDistance = Math.sqrt(dx * dx + dy * dy);
        this.gestureState.startAngle = Math.atan2(dy, dx);
        
        // Get center point in normalized device coordinates
        const rect = this.canvas.getBoundingClientRect();
        const centerX = (touches[0].clientX + touches[1].clientX) / 2;
        const centerY = (touches[0].clientY + touches[1].clientY) / 2;
        const ndcX = ((centerX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((centerY - rect.top) / rect.height) * 2 + 1;
        
        // Check for intersections at center point
        const intersects = this.getIntersects(ndcX, ndcY);
        if (intersects.length > 0) {
          // Get object to scale/rotate
          const object = this.findScaleableParent(intersects[0].object);
          if (object) {
            this.gestureState.selectedObject = object;
            
            // Store original scale for pinch to zoom
            this.gestureState.startScale = object.scale.x; // Assuming uniform scale
          }
        }
        
        // Hide tooltip during multi-touch
        this.clearTooltip();
      }
    }
  }
  
  /**
   * Handle touch move with enhanced gesture support
   * @param {TouchEvent} event - Touch event
   */
  handleTouchMove(event) {
    if (!this.interactionEnabled || this.gestureState.isAnimating) return;
    
    // Prevent default to avoid scrolling/zooming page
    event.preventDefault();
    
    const touches = event.touches;
    
    if (touches.length === 1 && this.gestureState.selectedObject) {
      // Handle object dragging
      if (this.gestureState.isDraggable) {
        this.handleObjectDrag(touches[0]);
      } else {
        // Show hover tooltip
        const touch = touches[0];
        this.handleObjectHover(this.hoveredObject, touch.clientX, touch.clientY);
      }
    } else if (touches.length === 2 && this.gestureState.isMultiTouch) {
      // Handle pinch/rotate gestures
      this.handleMultiTouchGesture(touches);
    }
  }
  
  /**
   * Handle touch end with gesture completion
   * @param {TouchEvent} event - Touch event
   */
  handleTouchEnd(event) {
    if (!this.interactionEnabled) return;
    
    // Prevent default behavior
    event.preventDefault();
    
    // Get remaining touches
    const touches = event.touches;
    
    if (touches.length === 0) {
      // All touches ended
      
      // Check for simple tap
      if (!this.gestureState.dragging && this.hoveredObject) {
        const touch = event.changedTouches[0];
        const deltaX = Math.abs(touch.clientX - this.gestureState.dragStartPosition.x);
        const deltaY = Math.abs(touch.clientY - this.gestureState.dragStartPosition.y);
        
        if (deltaX < 10 && deltaY < 10) {
          // This was a tap, handle it as a click
          this.handleObjectClick(this.hoveredObject);
        }
      }
      
      // Complete any drag with momentum
      if (this.gestureState.dragging && this.gestureState.selectedObject) {
        this.completeObjectDrag();
      }
      
      // Reset gesture state
      this.gestureState.dragging = false;
      this.gestureState.selectedObject = null;
      this.gestureState.isDraggable = false;
      this.gestureState.isMultiTouch = false;
      
      // Remove any drag indicators
      this.hideDragIndicators();
      
      // Reset hover state after a brief delay (to allow click handling)
      setTimeout(() => {
        this.hoveredObject = null;
        this.clearTooltip();
      }, 100);
    } else if (touches.length === 1) {
      // Multi-touch ended, back to single touch
      this.gestureState.isMultiTouch = false;
      
      // Reset touch tracking for the remaining touch
      const touch = touches[0];
      this.gestureState.dragStartPosition = { x: touch.clientX, y: touch.clientY };
      
      // Convert to normalized coordinates
      const rect = this.canvas.getBoundingClientRect();
      const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Check for new intersections with the remaining touch
      const intersects = this.getIntersects(x, y);
      if (intersects.length > 0) {
        this.hoveredObject = intersects[0].object;
      } else {
        this.hoveredObject = null;
      }
      
      // Reset selection
      this.gestureState.selectedObject = null;
      this.gestureState.isDraggable = false;
    }
    
    // Update touch tracking
    this.gestureState.touches = [];
    for (let i = 0; i < touches.length; i++) {
      this.gestureState.touches.push({
        id: touches[i].identifier,
        x: touches[i].clientX,
        y: touches[i].clientY
      });
    }
  }
  
  /**
   * Handle double tap gesture
   * @param {number} x - Normalized x coordinate
   * @param {number} y - Normalized y coordinate
   */
  handleDoubleTap(x, y) {
    // Check for intersections
    const intersects = this.getIntersects(x, y);
    if (intersects.length > 0) {
      const object = intersects[0].object;
      
      // Find what kind of object was tapped
      const objectType = this.getObjectType(object);
      
      // Perform action based on object type
      switch (objectType) {
        case 'house':
          // Zoom to house with animation
          this.zoomToObject(object, 1.5);
          break;
        case 'dtiBar':
        case 'maxDtiBar':
          // Zoom to bar with animation
          this.zoomToObject(object, 2);
          break;
        case 'paymentObject':
          // Zoom to payment object
          this.zoomToObject(object, 2.5);
          break;
        default:
          // Reset camera view
          this.resetCameraWithAnimation();
          break;
      }
    } else {
      // Double tap on empty space resets the camera
      this.resetCameraWithAnimation();
    }
    
    // Add ripple effect at tap location
    this.addTapRippleEffect(x, y);
  }
  
  /**
   * Handle object dragging
   * @param {Touch} touch - Current touch point
   */
  handleObjectDrag(touch) {
    if (!this.gestureState.selectedObject) return;
    
    // Mark as dragging
    this.gestureState.dragging = true;
    
    // Calculate drag distance
    const deltaX = touch.clientX - this.gestureState.dragStartPosition.x;
    const deltaY = touch.clientY - this.gestureState.dragStartPosition.y;
    
    // Convert screen space deltas to world space
    const dragVector = this.screenToWorldDelta(deltaX, deltaY);
    
    // Get object and its type
    const object = this.gestureState.selectedObject;
    const objectType = this.getObjectType(object);
    
    // Apply drag based on object type
    switch (objectType) {
      case 'house':
        // Rotate house based on drag for a more intuitive interaction
        object.rotation.y = this.gestureState.objectStartRotation.y + (deltaX * 0.01);
        
        // Limit vertical rotation to avoid flipping
        const maxTilt = Math.PI / 8;
        object.rotation.x = Math.max(-maxTilt, 
                           Math.min(maxTilt, 
                                   this.gestureState.objectStartRotation.x + (deltaY * 0.005)));
        break;
      
      case 'dtiBar':
      case 'maxDtiBar':
        // Allow vertical dragging to adjust bar height (value)
        const heightDelta = -deltaY * 0.01; // Invert Y so dragging up increases value
        
        // Calculate new height (with min/max constraints)
        let newHeight = this.gestureState.objectStartPosition.y + heightDelta;
        newHeight = Math.max(0.1, Math.min(5, newHeight * 2)) / 2; // Half height for position
        
        // Update bar height
        if (objectType === 'dtiBar') {
          // Calculate DTI percentage based on height (max height 5 = 50% DTI)
          const newDti = (newHeight * 2) * 10; // Convert height to percentage
          
          // Update current data
          this.currentData.dti = Math.round(newDti * 10) / 10; // Round to 1 decimal
          
          // Update bar scale and position
          object.scale.y = newHeight * 2;
          object.position.y = newHeight;
          
          // Update label
          if (this.dtiLabel) {
            this.dtiLabel.textContent = `Current DTI: ${this.currentData.dti.toFixed(1)}%`;
            this.dtiLabel.classList.add('updated');
          }
        } else {
          // Similar logic for max DTI bar
          const newMaxDti = (newHeight * 2) * 10;
          this.currentData.maxDti = Math.round(newMaxDti * 10) / 10;
          
          object.scale.y = newHeight * 2;
          object.position.y = newHeight;
          
          if (this.maxDtiLabel) {
            this.maxDtiLabel.textContent = `Max DTI: ${this.currentData.maxDti.toFixed(1)}%`;
            this.maxDtiLabel.classList.add('updated');
          }
        }
        
        // Update label positions
        this.updateLabelPositions();
        break;
        
      case 'paymentObject':
        // Allow horizontal dragging for payment amount
        const paymentDelta = deltaX * 10; // Scale for more noticeable effect
        
        // Calculate new payment (with constraints)
        let newPayment = this.currentData.maxMonthlyPayment + paymentDelta;
        newPayment = Math.max(500, Math.min(5000, newPayment));
        
        // Update payment amount
        this.currentData.maxMonthlyPayment = Math.round(newPayment / 10) * 10;
        
        // Update visual representation (e.g., coin stack height)
        this.updatePaymentVisualization();
        
        // Update affordability label
        if (this.affordabilityLabel) {
          this.affordabilityLabel.textContent = `Max Payment: $${this.formatNumber(this.currentData.maxMonthlyPayment)}`;
          this.affordabilityLabel.classList.add('updated');
        }
        break;
        
      default:
        // For other objects, just apply the drag directly (limited range)
        const maxMove = 1; // Maximum movement allowed
        object.position.x = this.gestureState.objectStartPosition.x + Math.max(-maxMove, Math.min(maxMove, dragVector.x));
        object.position.z = this.gestureState.objectStartPosition.z + Math.max(-maxMove, Math.min(maxMove, dragVector.z));
        break;
    }
    
    // Dispatch event for data changes
    this.dispatchDataChangeEvent();
  }
  
  /**
   * Complete object drag with momentum
   */
  completeObjectDrag() {
    // Calculate momentum based on recent drag velocity
    // For now, just snap back to valid positions
    
    // Get object and its type
    const object = this.gestureState.selectedObject;
    const objectType = this.getObjectType(object);
    
    // Special handling for different object types
    switch (objectType) {
      case 'house':
        // Animate house back to normalized rotation
        this.animateProperty(object.rotation, 'y', object.rotation.y, 
                            Math.round(object.rotation.y / (Math.PI/4)) * (Math.PI/4), 500);
        this.animateProperty(object.rotation, 'x', object.rotation.x, 0, 500);
        break;
        
      case 'dtiBar':
      case 'maxDtiBar':
        // Already handled by updating the data values
        // Add particle effect to show completion
        this.addBarTopParticles(object.position.clone(), 
                              objectType === 'dtiBar' ? 0x3498db : 0xe74c3c);
        break;
        
      case 'paymentObject':
        // Add effect to show payment change completion
        const paymentPos = this.objects.paymentCylinder.position.clone();
        paymentPos.y += 1;
        this.addBarTopParticles(paymentPos, 0x2ecc71);
        break;
        
      default:
        // Animate other objects back to their start positions
        this.animateProperty(object.position, 'x', object.position.x, 
                            this.gestureState.objectStartPosition.x, 500);
        this.animateProperty(object.position, 'z', object.position.z, 
                            this.gestureState.objectStartPosition.z, 500);
        break;
    }
    
    // Notify data source of changes if connected
    if (this.dataSource && typeof this.dataSource.updateVisualizationData === 'function') {
      this.dataSource.updateVisualizationData(this.currentData);
    }
  }
  
  /**
   * Handle multi-touch gestures (pinch/zoom and rotate)
   * @param {TouchList} touches - Current touch points
   */
  handleMultiTouchGesture(touches) {
    if (touches.length !== 2 || !this.gestureState.selectedObject) return;
    
    // Calculate current distance and angle
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    // Get scale factor based on distance change
    const scaleFactor = distance / this.gestureState.startDistance;
    
    // Get rotation angle change
    const angleDelta = angle - this.gestureState.startAngle;
    
    // Get object and its type
    const object = this.gestureState.selectedObject;
    const objectType = this.getObjectType(object);
    
    // Apply transformations based on object type
    switch (objectType) {
      case 'house':
        // Apply scaling within limits
        const newScale = this.gestureState.startScale * scaleFactor;
        const minScale = 0.5;
        const maxScale = 2.0;
        const clampedScale = Math.max(minScale, Math.min(maxScale, newScale));
        
        // Apply uniform scaling
        object.scale.set(clampedScale, clampedScale, clampedScale);
        
        // Apply rotation around y-axis
        object.rotation.y = this.gestureState.objectStartRotation.y + angleDelta;
        
        // Update house size factor in data
        this.currentData.houseSize = clampedScale;
        break;
        
      case 'dtiGroup':
        // For DTI group, allow scaling and rotating the entire visualization
        const groupScale = this.gestureState.startScale * Math.max(0.5, Math.min(1.5, scaleFactor));
        object.scale.set(groupScale, groupScale, groupScale);
        
        // Rotate group around y-axis
        object.rotation.y = this.gestureState.objectStartRotation.y + angleDelta;
        break;
        
      default:
        // Generic object manipulation
        const objScale = this.gestureState.startScale * Math.max(0.5, Math.min(1.5, scaleFactor));
        object.scale.set(objScale, objScale, objScale);
        
        // Rotate object based on gesture
        object.rotation.y = this.gestureState.objectStartRotation.y + angleDelta;
        break;
    }
    
    // Update visual elements
    this.updateLabelPositions();
  }
  
  /**
   * Handle keyboard events for accessibility and debug
   * @param {KeyboardEvent} event - Keyboard event
   */
  handleKeyDown(event) {
    if (!this.interactionEnabled) return;
    
    // Navigation keys for camera
    switch (event.key) {
      case 'ArrowLeft':
        // Rotate camera left
        this.camera.position.x = this.camera.position.x * Math.cos(0.1) + this.camera.position.z * Math.sin(0.1);
        this.camera.position.z = -this.camera.position.x * Math.sin(0.1) + this.camera.position.z * Math.cos(0.1);
        this.camera.lookAt(0, 0, 0);
        break;
      case 'ArrowRight':
        // Rotate camera right
        this.camera.position.x = this.camera.position.x * Math.cos(-0.1) + this.camera.position.z * Math.sin(-0.1);
        this.camera.position.z = -this.camera.position.x * Math.sin(-0.1) + this.camera.position.z * Math.cos(-0.1);
        this.camera.lookAt(0, 0, 0);
        break;
      case 'ArrowUp':
        // Move camera closer (with modifier) or higher
        if (event.shiftKey) {
          // Move closer
          const direction = new THREE.Vector3(0, 0, 0).sub(this.camera.position).normalize();
          this.camera.position.addScaledVector(direction, 0.5);
        } else {
          // Move higher
          this.camera.position.y += 0.5;
        }
        this.camera.lookAt(0, 0, 0);
        break;
      case 'ArrowDown':
        // Move camera farther (with modifier) or lower
        if (event.shiftKey) {
          // Move farther
          const direction = new THREE.Vector3(0, 0, 0).sub(this.camera.position).normalize();
          this.camera.position.addScaledVector(direction, -0.5);
        } else {
          // Move lower
          this.camera.position.y = Math.max(1, this.camera.position.y - 0.5);
        }
        this.camera.lookAt(0, 0, 0);
        break;
      case 'r':
        // Reset camera
        this.resetCameraWithAnimation();
        break;
      case '1':
        // House view
        this.setVisualizationMode('house');
        break;
      case '2':
        // DTI view
        this.setVisualizationMode('dti');
        break;
      case '3':
        // Affordability view
        this.setVisualizationMode('affordability');
        break;
    }
  }
  
  /**
   * Reset camera with smooth animation
   */
  resetCameraWithAnimation() {
    // Define target position based on current mode
    let targetPosition;
    
    switch (this.currentMode) {
      case 'house':
        targetPosition = { x: 0, y: 3, z: 8 };
        break;
      case 'dti':
        targetPosition = { x: 0, y: 4, z: 6 };
        break;
      case 'affordability':
        targetPosition = { x: 5, y: 5, z: 8 };
        break;
      default:
        targetPosition = { x: 0, y: 3, z: 8 };
    }
    
    // Animate camera to target position
    this.animateCamera(targetPosition);
  }
  
  /**
   * Zoom to a specific object with animation
   * @param {THREE.Object3D} object - Object to zoom to
   * @param {number} factor - Zoom factor
   */
  zoomToObject(object, factor = 1.5) {
    if (!object) return;
    
    // Calculate target position
    const objectPos = new THREE.Vector3();
    object.getWorldPosition(objectPos);
    
    // Get direction from current camera to object
    const direction = new THREE.Vector3().subVectors(objectPos, this.camera.position).normalize();
    
    // Calculate new camera position closer to object
    const distance = this.camera.position.distanceTo(objectPos) / factor;
    const targetPos = new THREE.Vector3().copy(objectPos).sub(direction.multiplyScalar(distance));
    
    // Ensure minimum height
    targetPos.y = Math.max(2, targetPos.y);
    
    // Animate camera to new position
    this.animateCamera({
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z
    });
    
    // Add highlight effect to object
    this.highlightObject(object);
  }
  
  /**
   * Add visual highlight to an object
   * @param {THREE.Object3D} object - Object to highlight
   */
  highlightObject(object) {
    // Store original material
    const originalMaterial = object.material ? object.material.clone() : null;
    
    if (originalMaterial) {
      // Create highlight material
      const highlightMaterial = originalMaterial.clone();
      
      // Make it glow by adding emissive
      if (highlightMaterial.emissive) {
        highlightMaterial.emissive.set(0x5465FF);
        highlightMaterial.emissiveIntensity = 0.5;
      }
      
      // Apply highlight material
      object.material = highlightMaterial;
      
      // Animate object scale for pulse effect
      const originalScale = object.scale.clone();
      const pulseScale = originalScale.clone().multiplyScalar(1.05);
      
      // Pulse animation
      const duration = 300;
      const pulseCount = 2;
      
      // Create pulse sequence
      const pulsate = (count) => {
        // Scale up
        this.animateVectorProperty(object.scale, originalScale, pulseScale, duration/2, () => {
          // Scale down
          this.animateVectorProperty(object.scale, pulseScale, originalScale, duration/2, () => {
            // Continue pulsing if count remains
            if (count > 1) {
              pulsate(count - 1);
            } else {
              // Restore original material after animation
              object.material = originalMaterial;
            }
          });
        });
      };
      
      // Start pulse animation
      pulsate(pulseCount);
    }
  }
  
  /**
   * Add ripple effect at tap location
   * @param {number} x - Normalized x coordinate (-1 to 1)
   * @param {number} y - Normalized y coordinate (-1 to 1)
   */
  addTapRippleEffect(x, y) {
    // Create a raycast to get world position for ripple
    this.raycaster = this.raycaster || new THREE.Raycaster();
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    
    // Get position on ground plane
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const targetPoint = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(groundPlane, targetPoint);
    
    // Create ripple effect at point
    for (let i = 0; i < 2; i++) {
      const rippleGeometry = new THREE.RingGeometry(0.1, 0.15, 32);
      const rippleMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
      });
      
      const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
      ripple.position.copy(targetPoint);
      ripple.position.y = 0.02;
      ripple.rotation.x = -Math.PI / 2;
      this.scene.add(ripple);
      
      // Stagger second ripple
      const delay = i * 150;
      
      // Animate ripple
      setTimeout(() => {
        const startTime = Date.now();
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const duration = 800;
          const progress = Math.min(1, elapsed / duration);
          
          // Scale up
          ripple.scale.set(1 + progress * 10, 1 + progress * 10, 1);
          
          // Fade out
          rippleMaterial.opacity = 0.7 * (1 - progress);
          
          // Continue animation until complete
          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            // Remove ripple
            this.scene.remove(ripple);
            rippleGeometry.dispose();
            rippleMaterial.dispose();
          }
        };
        
        // Start animation
        animate();
      }, delay);
    }
  }
  
  /**
   * Check if an object is draggable
   * @param {THREE.Object3D} object - Object to check
   * @returns {boolean} - Whether object is draggable
   */
  isObjectDraggable(object) {
    if (!object) return false;
    
    // Get object type
    const objectType = this.getObjectType(object);
    
    // Define which objects are draggable
    const draggableTypes = ['house', 'dtiBar', 'maxDtiBar', 'paymentObject'];
    
    return draggableTypes.includes(objectType);
  }
  
  /**
   * Get the type of an object for interaction handling
   * @param {THREE.Object3D} object - Object to check
   * @returns {string} - Object type
   */
  getObjectType(object) {
    if (!object) return 'unknown';
    
    // Check user data
    if (object.userData && object.userData.type) {
      return object.userData.type;
    }
    
    // Check if it's part of group
    if (object === this.objects.house || object === this.objects.roof) {
      return 'house';
    } else if (object === this.objects.dtiBar) {
      return 'dtiBar';
    } else if (object === this.objects.maxDtiBar) {
      return 'maxDtiBar';
    } else if (object === this.dtiGroup) {
      return 'dtiGroup';
    } else if (object === this.objects.paymentCylinder || 
              (this.objects.coinGroup && this.objects.coinGroup.children.includes(object))) {
      return 'paymentObject';
    }
    
    return 'unknown';
  }
  
  /**
   * Find the parent object that can be scaled/rotated
   * @param {THREE.Object3D} object - Object to check
   * @returns {THREE.Object3D} - Scaleable parent
   */
  findScaleableParent(object) {
    // For house - return house group
    if (object === this.objects.house || object === this.objects.roof || 
        (this.houseGroup && this.houseGroup.children.includes(object))) {
      return this.objects.house;
    }
    
    // For DTI bars - return DTI group
    if (object === this.objects.dtiBar || object === this.objects.maxDtiBar ||
        (this.dtiGroup && this.dtiGroup.children.includes(object))) {
      return this.dtiGroup;
    }
    
    // For affordability visualization
    if (this.affordabilityGroup && this.affordabilityGroup.children.includes(object)) {
      return this.affordabilityGroup;
    }
    
    return object;
  }
  
  /**
   * Show drag indicator for an object
   * @param {THREE.Object3D} object - Object to show indicator for
   */
  showDragIndicator(object) {
    // Add subtle glow to indicate object is draggable
    if (!object.material) return;
    
    // Store original material if not already stored
    if (!object._originalMaterial) {
      object._originalMaterial = object.material.clone();
    }
    
    // Create drag indicator material
    const dragMaterial = object.material.clone();
    
    // Add emissive glow
    if (dragMaterial.emissive) {
      dragMaterial.emissive.set(0x5465FF);
      dragMaterial.emissiveIntensity = 0.3;
    }
    
    // Apply drag material
    object.material = dragMaterial;
  }
  
  /**
   * Hide all drag indicators
   */
  hideDragIndicators() {
    // Restore original materials for all objects
    Object.values(this.objects).forEach(object => {
      if (object && object._originalMaterial) {
        object.material = object._originalMaterial;
        object._originalMaterial = null;
      }
    });
  }
  
  /**
   * Convert screen space delta to world space
   * @param {number} deltaX - Screen space X delta
   * @param {number} deltaY - Screen space Y delta
   * @returns {THREE.Vector3} - World space delta
   */
  screenToWorldDelta(deltaX, deltaY) {
    // Get camera right and up vectors
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    
    // Scale by camera distance
    const distance = this.camera.position.length();
    const scale = distance / 500;
    
    // Create delta vector
    return new THREE.Vector3()
      .addScaledVector(right, deltaX * scale)
      .addScaledVector(up, -deltaY * scale); // Invert Y for screen space
  }
  
  /**
   * Update payment visualization based on current data
   */
  updatePaymentVisualization() {
    if (!this.objects.paymentCylinder) return;
    
    // Calculate coin count based on payment amount
    const paymentAmount = this.currentData.maxMonthlyPayment;
    const coinCount = Math.min(20, Math.max(5, Math.floor(paymentAmount / 200)));
    
    // Update coin group if it exists
    if (this.objects.coinGroup) {
      // Remove existing coins
      while (this.objects.coinGroup.children.length > 0) {
        const coin = this.objects.coinGroup.children[0];
        this.objects.coinGroup.remove(coin);
        if (coin.geometry) coin.geometry.dispose();
        if (coin.material) coin.material.dispose();
      }
      
      // Add new coins
      const coinGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.05, 32);
      const coinMaterial = new THREE.MeshStandardMaterial({
        color: 0xf1c40f,
        roughness: 0.3,
        metalness: 0.8
      });
      
      for (let i = 0; i < coinCount; i++) {
        const coin = new THREE.Mesh(coinGeometry, coinMaterial);
        coin.position.y = i * 0.06;
        coin.rotation.x = Math.PI / 2;
        this.objects.coinGroup.add(coin);
      }
    }
  }
  
  /**
   * Animate a property with easing
   * @param {Object} object - Object containing the property
   * @param {string} property - Property name
   * @param {number} start - Start value
   * @param {number} end - End value
   * @param {number} duration - Animation duration in ms
   * @param {Function} onComplete - Callback when animation completes
   */
  animateProperty(object, property, start, end, duration, onComplete) {
    const startTime = Date.now();
    
    // Set animating flag
    this.gestureState.isAnimating = true;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Use cubic easing
      const eased = 1 - Math.pow(1 - progress, 3);
      
      // Update property
      object[property] = start + (end - start) * eased;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure final value
        object[property] = end;
        
        // Clear animating flag
        this.gestureState.isAnimating = false;
        
        // Call completion callback
        if (onComplete) onComplete();
      }
    };
    
    // Start animation
    animate();
  }
  
  /**
   * Animate a vector property with easing
   * @param {THREE.Vector3} vector - Vector to animate
   * @param {THREE.Vector3} start - Start vector
   * @param {THREE.Vector3} end - End vector
   * @param {number} duration - Animation duration in ms
   * @param {Function} onComplete - Callback when animation completes
   */
  animateVectorProperty(vector, start, end, duration, onComplete) {
    const startTime = Date.now();
    
    // Set animating flag
    this.gestureState.isAnimating = true;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Use cubic easing
      const eased = 1 - Math.pow(1 - progress, 3);
      
      // Update vector components
      vector.x = start.x + (end.x - start.x) * eased;
      vector.y = start.y + (end.y - start.y) * eased;
      vector.z = start.z + (end.z - start.z) * eased;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure final values
        vector.copy(end);
        
        // Clear animating flag
        this.gestureState.isAnimating = false;
        
        // Call completion callback
        if (onComplete) onComplete();
      }
    };
    
    // Start animation
    animate();
  }
  
  /**
   * Dispatch event for data changes
   */
  dispatchDataChangeEvent() {
    const event = new CustomEvent('visualization-data-changed', {
      detail: { data: this.currentData }
    });
    document.dispatchEvent(event);
  }
  
  /**
   * Get intersected objects from mouse/touch position
   * @param {number} x - Normalized x coordinate (-1 to 1)
   * @param {number} y - Normalized y coordinate (-1 to 1)
   * @returns {Array} Array of intersected objects
   */
  getIntersects(x, y) {
    // Create raycaster for picking
    this.raycaster = this.raycaster || new THREE.Raycaster();
    this.mouse = this.mouse || new THREE.Vector2();
    
    // Update mouse coordinates
    this.mouse.x = x;
    this.mouse.y = y;
    
    // Set raycaster from camera
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Get intersected objects
    return this.raycaster.intersectObjects(this.scene.children, true);
  }
  
  /**
   * Handle object hover
   * @param {THREE.Object3D} object - Hovered object
   * @param {number} clientX - Mouse/touch X position
   * @param {number} clientY - Mouse/touch Y position
   */
  handleObjectHover(object, clientX, clientY) {
    // Get user data (if any)
    const userData = object.userData || {};
    
    // Show tooltip based on object type
    let tooltipText = '';
    
    switch (userData.type) {
      case 'house':
        tooltipText = `House Value: $${this.formatNumber(this.currentData.targetHomePrice)}`;
        break;
      case 'roof':
        tooltipText = `Down Payment: $${this.formatNumber(this.currentData.downPayment)} (${this.currentData.downPaymentPercent}%)`;
        break;
      case 'dtiBar':
        tooltipText = `Current DTI: ${this.currentData.dti}%`;
        break;
      case 'maxDtiBar':
        tooltipText = `Maximum DTI: ${this.currentData.maxDti}%`;
        break;
      default:
        break;
    }
    
    if (tooltipText) {
      // Position and show tooltip
      this.showTooltip(tooltipText, clientX, clientY);
    } else {
      this.clearTooltip();
    }
  }
  
  /**
   * Handle object click
   * @param {THREE.Object3D} object - Clicked object
   */
  handleObjectClick(object) {
    // Get user data (if any)
    const userData = object.userData || {};
    
    // Handle click based on object type
    switch (userData.type) {
      case 'house':
      case 'roof':
        this.setVisualizationMode('house');
        break;
      case 'dtiBar':
      case 'maxDtiBar':
        this.setVisualizationMode('dti');
        break;
      default:
        break;
    }
  }
  
  /**
   * Show tooltip at mouse/touch position
   * @param {string} text - Tooltip text
   * @param {number} x - Mouse/touch X position
   * @param {number} y - Mouse/touch Y position
   */
  showTooltip(text, x, y) {
    this.tooltip.textContent = text;
    this.tooltip.style.left = `${x + 10}px`;
    this.tooltip.style.top = `${y + 10}px`;
    this.tooltip.classList.add('visible');
  }
  
  /**
   * Clear current tooltip
   */
  clearTooltip() {
    this.tooltip.classList.remove('visible');
  }
  
  /**
   * Set current visualization mode with enhanced transitions
   * @param {string} mode - Visualization mode ('house', 'dti', 'affordability')
   */
  setVisualizationMode(mode) {
    if (mode === this.currentMode) return;
    
    const previousMode = this.currentMode;
    this.currentMode = mode;
    
    // Update active button
    document.querySelectorAll('.visualization-control-button').forEach(button => {
      if (button.getAttribute('data-mode') === mode) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // Hide all labels with fade transition
    if (this.dtiLabel) this.dtiLabel.style.opacity = '0';
    if (this.maxDtiLabel) this.maxDtiLabel.style.opacity = '0';
    if (this.affordabilityLabel) this.affordabilityLabel.style.opacity = '0';
    
    // Create transition animation
    const transitionObjects = () => {
      // Hide previous visualization with fade
      if (previousMode === 'house') {
        // Fade out house
        const fadeDuration = 500; // ms
        const startTime = Date.now();
        
        // Store original materials
        const houseMaterial = this.objects.house.material.clone();
        const roofMaterial = this.objects.roof.material.clone();
        
        // Create fade animation
        const fadeOut = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(1, elapsed / fadeDuration);
          
          // Fade out opacity
          this.objects.house.material.opacity = 1 - progress;
          this.objects.roof.material.opacity = 1 - progress;
          
          if (progress < 1) {
            requestAnimationFrame(fadeOut);
          } else {
            // Hide objects and restore materials
            this.objects.house.visible = false;
            this.objects.roof.visible = false;
            this.objects.house.material = houseMaterial;
            this.objects.roof.material = roofMaterial;
            
            // Show new visualization
            showNewVisualization();
          }
        };
        
        // Make materials transparent
        this.objects.house.material = this.objects.house.material.clone();
        this.objects.house.material.transparent = true;
        this.objects.roof.material = this.objects.roof.material.clone();
        this.objects.roof.material.transparent = true;
        
        // Start animation
        fadeOut();
      } else if (previousMode === 'dti') {
        // Shrink DTI bars
        const shrinkDuration = 500; // ms
        const startTime = Date.now();
        
        // Store original scales
        const dtiScale = this.objects.dtiBar.scale.y;
        const maxDtiScale = this.objects.maxDtiBar.scale.y;
        
        // Create shrink animation
        const shrinkBars = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(1, elapsed / shrinkDuration);
          
          // Ease out
          const eased = 1 - Math.pow(1 - progress, 2);
          
          // Shrink bars
          this.objects.dtiBar.scale.y = dtiScale * (1 - eased);
          this.objects.maxDtiBar.scale.y = maxDtiScale * (1 - eased);
          
          // Update positions
          this.objects.dtiBar.position.y = this.objects.dtiBar.scale.y / 2;
          this.objects.maxDtiBar.position.y = this.objects.maxDtiBar.scale.y / 2;
          
          if (progress < 1) {
            requestAnimationFrame(shrinkBars);
          } else {
            // Hide group
            this.dtiGroup.visible = false;
            
            // Reset scales for next time
            this.objects.dtiBar.scale.y = dtiScale;
            this.objects.maxDtiBar.scale.y = maxDtiScale;
            this.objects.dtiBar.position.y = dtiScale / 2;
            this.objects.maxDtiBar.position.y = maxDtiScale / 2;
            
            // Show new visualization
            showNewVisualization();
          }
        };
        
        // Start animation
        shrinkBars();
      } else if (previousMode === 'affordability') {
        // Fade out affordability visualization
        // Similar transition as with house
        this.objects.house.visible = false;
        this.objects.roof.visible = false;
        this.dtiGroup.visible = false;
        
        // Show new visualization
        showNewVisualization();
      } else {
        // No previous mode, just show new visualization
        showNewVisualization();
      }
    };
    
    // Function to show new visualization with entrance animation
    const showNewVisualization = () => {
      switch (mode) {
        case 'house':
          // Check if we need to create or update affordability visualization
          if (!this.affordabilityVisualization && this.currentData.maxMonthlyPayment) {
            this.createAffordabilityVisualization();
          }
          
          // Set visibility
          this.objects.house.visible = true;
          this.objects.roof.visible = true;
          
          // Add entrance animation
          this.objects.house.scale.set(0.1, 0.1, 0.1);
          this.objects.roof.scale.set(0.1, 0.1, 0.1);
          
          // Animate scale up
          const duration = 800;
          const startTime = Date.now();
          const targetScale = Math.pow(this.currentData.targetHomePrice / 250000, 0.33) * this.currentData.houseSize;
          
          const scaleUp = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / duration);
            
            // Elastic easing
            const eased = this.elasticOut(progress);
            
            // Scale up
            const currentScale = 0.1 + (targetScale - 0.1) * eased;
            this.objects.house.scale.set(currentScale, currentScale, currentScale);
            this.objects.roof.scale.set(currentScale, currentScale, currentScale);
            
            // Update position
            const houseHeight = 2 * currentScale;
            this.objects.house.position.y = houseHeight / 2 - 0.5;
            
            const roofHeight = 1.2 * currentScale;
            this.objects.roof.position.y = houseHeight + roofHeight / 2 - 0.5;
            
            if (progress < 1) {
              requestAnimationFrame(scaleUp);
            }
          };
          
          // Start animation
          scaleUp();
          
          // Animate camera
          this.animateCamera({ x: 0, y: 3, z: 8 });
          break;
          
        case 'dti':
          // Set visibility
          this.dtiGroup.visible = true;
          
          // Add entrance animation - grow from bottom
          this.objects.dtiBar.scale.y = 0.01;
          this.objects.maxDtiBar.scale.y = 0.01;
          this.objects.dtiBar.position.y = 0.005;
          this.objects.maxDtiBar.position.y = 0.005;
          
          // Animate bars growing up
          const dtiDuration = 1000;
          const dtiStartTime = Date.now();
          const targetDtiHeight = (this.currentData.dti / 50) * 5;
          const targetMaxDtiHeight = (this.currentData.maxDti / 50) * 5;
          
          const growBars = () => {
            const elapsed = Date.now() - dtiStartTime;
            const progress = Math.min(1, elapsed / dtiDuration);
            
            // Use bounce easing
            const eased = this.bounceOut(progress);
            
            // Scale up
            this.objects.dtiBar.scale.y = 0.01 + (targetDtiHeight - 0.01) * eased;
            this.objects.maxDtiBar.scale.y = 0.01 + (targetMaxDtiHeight - 0.01) * eased;
            
            // Update positions
            this.objects.dtiBar.position.y = this.objects.dtiBar.scale.y / 2;
            this.objects.maxDtiBar.position.y = this.objects.maxDtiBar.scale.y / 2;
            
            // Update label positions
            this.updateLabelPositions();
            
            if (progress < 1) {
              requestAnimationFrame(growBars);
            } else {
              // Show labels
              if (this.dtiLabel) this.dtiLabel.style.opacity = '1';
              if (this.maxDtiLabel) this.maxDtiLabel.style.opacity = '1';
              
              // Add particle effect at the top
              this.addBarTopParticles(this.objects.dtiBar.position.clone(), 0x3498db);
              this.addBarTopParticles(this.objects.maxDtiBar.position.clone(), 0xe74c3c);
            }
          };
          
          // Start animation
          growBars();
          
          // Animate camera
          this.animateCamera({ x: 0, y: 4, z: 6 });
          break;
          
        case 'affordability':
          // Create affordability visualization if not exists
          if (!this.affordabilityVisualization && this.currentData.maxMonthlyPayment) {
            this.createAffordabilityVisualization();
          }
          
          // Show house and DTI with affordability context
          this.objects.house.visible = true;
          this.objects.roof.visible = true;
          this.dtiGroup.visible = true;
          
          // Show with staggered animation
          setTimeout(() => {
            // Show labels
            if (this.dtiLabel) this.dtiLabel.style.opacity = '1';
            if (this.maxDtiLabel) this.maxDtiLabel.style.opacity = '1';
            if (this.affordabilityLabel) this.affordabilityLabel.style.opacity = '1';
          }, 500);
          
          // Animate camera to overview position
          this.animateCamera({ x: 5, y: 5, z: 8 });
          break;
      }
      
      // Update info panel content
      this.updateInfoPanel();
    };
    
    // Start the transition
    transitionObjects();
  }
  
  /**
   * Create affordability visualization elements
   */
  createAffordabilityVisualization() {
    if (!this.currentData.maxMonthlyPayment) return;
    
    // Create affordability group
    this.affordabilityGroup = new THREE.Group();
    this.scene.add(this.affordabilityGroup);
    
    // Create monthly payment visualization
    const paymentGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.2, 32);
    const paymentMaterial = new THREE.MeshStandardMaterial({
      color: 0x2ecc71,
      roughness: 0.3,
      metalness: 0.7
    });
    
    this.objects.paymentCylinder = new THREE.Mesh(paymentGeometry, paymentMaterial);
    this.objects.paymentCylinder.position.set(3, 0.1, 0);
    this.objects.paymentCylinder.rotation.x = Math.PI / 2;
    this.affordabilityGroup.add(this.objects.paymentCylinder);
    
    // Create stack of coins to represent payment
    const coinGroup = new THREE.Group();
    coinGroup.position.set(3, 0.2, 0);
    
    const coinGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.05, 32);
    const coinMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      roughness: 0.3,
      metalness: 0.8
    });
    
    // Calculate number of coins based on payment
    const paymentAmount = this.currentData.maxMonthlyPayment;
    const coinCount = Math.min(20, Math.max(5, Math.floor(paymentAmount / 200)));
    
    for (let i = 0; i < coinCount; i++) {
      const coin = new THREE.Mesh(coinGeometry, coinMaterial);
      coin.position.y = i * 0.06;
      coin.rotation.x = Math.PI / 2;
      coinGroup.add(coin);
    }
    
    this.affordabilityGroup.add(coinGroup);
    
    // Create affordability label
    const affordabilityLabelEl = document.createElement('div');
    affordabilityLabelEl.className = 'data-label';
    affordabilityLabelEl.textContent = `Max Payment: $${this.formatNumber(this.currentData.maxMonthlyPayment)}`;
    document.querySelector('.visualization-container').appendChild(affordabilityLabelEl);
    this.affordabilityLabel = affordabilityLabelEl;
    this.affordabilityLabel.style.opacity = '0';
    
    // Create connecting lines
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    
    // Line from DTI to payment
    const dtiLineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(1, 1, 0),
      new THREE.Vector3(3, 0.2 + (coinCount * 0.06) / 2, 0)
    ]);
    const dtiLine = new THREE.Line(dtiLineGeometry, lineMaterial);
    this.affordabilityGroup.add(dtiLine);
    
    // Line from payment to house
    const houseLineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(3, 0.2 + (coinCount * 0.06) / 2, 0),
      new THREE.Vector3(0, 1, 0)
    ]);
    const houseLine = new THREE.Line(houseLineGeometry, lineMaterial);
    this.affordabilityGroup.add(houseLine);
    
    // Add particle system flowing along lines
    this.addFlowingParticles();
  }
  
  /**
   * Add particles flowing along connecting lines
   */
  addFlowingParticles() {
    // Create particle geometry
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = 50;
    
    // Create positions for particles
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    
    // Set random positions along paths
    for (let i = 0; i < particleCount; i++) {
      // Assign to one of the two paths
      const pathIndex = Math.floor(Math.random() * 2);
      
      // Path progress (0-1)
      const progress = Math.random();
      
      let x, y, z = 0;
      
      if (pathIndex === 0) {
        // DTI to payment
        x = 1 + (3 - 1) * progress;
        y = 1 + (0.5 - 1) * progress;
        
        // Green color
        colors[i * 3] = 0.2;
        colors[i * 3 + 1] = 0.8;
        colors[i * 3 + 2] = 0.3;
      } else {
        // Payment to house
        x = 3 - (3 - 0) * progress;
        y = 0.5 + (1 - 0.5) * progress;
        
        // Blue color
        colors[i * 3] = 0.2;
        colors[i * 3 + 1] = 0.6;
        colors[i * 3 + 2] = 0.9;
      }
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    
    // Set particle attributes
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Create particle material
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    
    // Create particle system
    this.particles = new THREE.Points(particleGeometry, particleMaterial);
    this.affordabilityGroup.add(this.particles);
    
    // Animate particles
    this.particleAnimationStartTime = Date.now();
    this.particleAnimation = true;
  }
  
  /**
   * Update particle animation in the main animation loop
   */
  updateParticleAnimation() {
    if (!this.particles || !this.particleAnimation) return;
    
    const positions = this.particles.geometry.attributes.position.array;
    const particleCount = positions.length / 3;
    
    // Flow particles along paths
    for (let i = 0; i < particleCount; i++) {
      // Get current position
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      
      // Determine which path and direction
      if (x < 2) {
        // DTI to payment path
        positions[i * 3] += 0.01;
        positions[i * 3 + 1] = 1 + (0.5 - 1) * ((positions[i * 3] - 1) / 2);
        
        // Reset if reached end
        if (positions[i * 3] > 3) {
          positions[i * 3] = 1;
          positions[i * 3 + 1] = 1;
        }
      } else {
        // Payment to house path
        positions[i * 3] -= 0.01;
        positions[i * 3 + 1] = 0.5 + (1 - 0.5) * (1 - (positions[i * 3] - 0) / 3);
        
        // Reset if reached end
        if (positions[i * 3] < 0) {
          positions[i * 3] = 3;
          positions[i * 3 + 1] = 0.5;
        }
      }
    }
    
    // Update geometry
    this.particles.geometry.attributes.position.needsUpdate = true;
  }
  
  /**
   * Elastic out easing function for natural animations
   * @param {number} x - Progress (0-1)
   * @returns {number} - Eased value
   */
  elasticOut(x) {
    const c4 = (2 * Math.PI) / 3;
    
    return x === 0
      ? 0
      : x === 1
      ? 1
      : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
  }
  
  /**
   * Bounce out easing function for natural animations
   * @param {number} x - Progress (0-1)
   * @returns {number} - Eased value
   */
  bounceOut(x) {
    const n1 = 7.5625;
    const d1 = 2.75;
    
    if (x < 1 / d1) {
      return n1 * x * x;
    } else if (x < 2 / d1) {
      return n1 * (x -= 1.5 / d1) * x + 0.75;
    } else if (x < 2.5 / d1) {
      return n1 * (x -= 2.25 / d1) * x + 0.9375;
    } else {
      return n1 * (x -= 2.625 / d1) * x + 0.984375;
    }
  }
  
  /**
   * Reset camera to default position
   */
  resetCamera() {
    this.camera.position.set(0, 3, 8);
    this.camera.lookAt(0, 0, 0);
  }
  
  /**
   * Animate camera to new position
   * @param {Object} position - Camera position {x, y, z}
   */
  animateCamera(position) {
    // Create animation
    this.cameraAnimation = {
      startPosition: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z
      },
      endPosition: position,
      startTime: Date.now(),
      duration: 1000
    };
  }
  
  /**
   * Update label positions based on object positions
   */
  updateLabelPositions() {
    if (!this.dtiLabel || !this.maxDtiLabel) return;
    
    // Project world positions to screen coordinates
    if (this.objects.dtiBar) {
      const dtiPos = this.objects.dtiBar.position.clone();
      // Move position to top of bar
      dtiPos.y += this.objects.dtiBar.scale.y / 2 + 0.2;
      const dtiScreenPos = this.worldToScreen(dtiPos, this.dtiGroup);
      this.dtiLabel.style.left = `${dtiScreenPos.x}px`;
      this.dtiLabel.style.top = `${dtiScreenPos.y}px`;
    }
    
    if (this.objects.maxDtiBar) {
      const maxDtiPos = this.objects.maxDtiBar.position.clone();
      // Move position to top of bar
      maxDtiPos.y += this.objects.maxDtiBar.scale.y / 2 + 0.2;
      const maxDtiScreenPos = this.worldToScreen(maxDtiPos, this.dtiGroup);
      this.maxDtiLabel.style.left = `${maxDtiScreenPos.x}px`;
      this.maxDtiLabel.style.top = `${maxDtiScreenPos.y}px`;
    }
  }
  
  /**
   * Convert world position to screen coordinates
   * @param {THREE.Vector3} position - World position
   * @param {THREE.Object3D} parent - Parent object (optional)
   * @returns {Object} Screen coordinates {x, y}
   */
  worldToScreen(position, parent = null) {
    // Get world position if position has a parent
    let worldPosition = position.clone();
    if (parent) {
      parent.updateMatrixWorld();
      worldPosition.applyMatrix4(parent.matrixWorld);
    }
    
    // Project position to screen space
    const projectedPosition = worldPosition.project(this.camera);
    
    return {
      x: (projectedPosition.x * 0.5 + 0.5) * window.innerWidth,
      y: (- projectedPosition.y * 0.5 + 0.5) * window.innerHeight
    };
  }
  
  /**
   * Main animation loop
   */
  animate() {
    requestAnimationFrame(this.animate.bind(this));
    
    // Update camera animation
    this.updateCameraAnimation();
    
    // Update object rotations
    this.updateObjectAnimations();
    
    // Update particle animation for affordability view
    if (this.currentMode === 'affordability' && this.particles) {
      this.updateParticleAnimation();
    }
    
    // Update label positions
    if (this.dtiGroup.visible) {
      this.updateLabelPositions();
    }
    
    // Update affordability label position if visible
    if (this.affordabilityLabel && parseFloat(this.affordabilityLabel.style.opacity) > 0) {
      if (this.objects.paymentCylinder) {
        const paymentPos = this.objects.paymentCylinder.position.clone();
        paymentPos.y += 0.5; // Position above the coins
        const screenPos = this.worldToScreen(paymentPos, this.affordabilityGroup);
        this.affordabilityLabel.style.left = `${screenPos.x}px`;
        this.affordabilityLabel.style.top = `${screenPos.y}px`;
      }
    }
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
  
  /**
   * Update camera animation
   */
  updateCameraAnimation() {
    if (!this.cameraAnimation) return;
    
    const elapsed = Date.now() - this.cameraAnimation.startTime;
    const progress = Math.min(1, elapsed / this.cameraAnimation.duration);
    
    // Use cubic easing for natural movement
    const eased = 1 - Math.pow(1 - progress, 3);
    
    // Update camera position
    this.camera.position.x = this.cameraAnimation.startPosition.x + 
      (this.cameraAnimation.endPosition.x - this.cameraAnimation.startPosition.x) * eased;
    this.camera.position.y = this.cameraAnimation.startPosition.y + 
      (this.cameraAnimation.endPosition.y - this.cameraAnimation.startPosition.y) * eased;
    this.camera.position.z = this.cameraAnimation.startPosition.z + 
      (this.cameraAnimation.endPosition.z - this.cameraAnimation.startPosition.z) * eased;
    
    // Look at center
    this.camera.lookAt(0, 0, 0);
    
    // Clear animation when done
    if (progress >= 1) {
      this.cameraAnimation = null;
    }
  }
  
  /**
   * Update object animations
   */
  updateObjectAnimations() {
    // Add subtle rotations to objects
    if (this.objects.house && this.objects.house.visible) {
      this.objects.house.rotation.y = Math.sin(Date.now() * 0.0005) * 0.05;
      this.objects.roof.rotation.y = Math.PI / 4 + Math.sin(Date.now() * 0.0005) * 0.05;
    }
    
    // Add subtle bounces to bars
    if (this.dtiGroup.visible) {
      if (this.objects.dtiBar) {
        this.objects.dtiBar.position.y = 
          this.objects.dtiBar.scale.y / 2 + Math.sin(Date.now() * 0.002) * 0.03;
      }
      if (this.objects.maxDtiBar) {
        this.objects.maxDtiBar.position.y = 
          this.objects.maxDtiBar.scale.y / 2 + Math.sin(Date.now() * 0.002 + 1) * 0.03;
      }
    }
  }
  
  /**
   * Update house scale based on price with smooth animation
   * @param {Object} prevData - Previous data values for animation
   */
  updateHouseScale(prevData = {}) {
    if (!this.objects.house || !this.objects.roof) return;
    
    // Calculate scale based on target price
    // Default is 250,000 = scale 1
    const basePrice = 250000;
    const priceRatio = this.currentData.targetHomePrice / basePrice;
    
    // Apply non-linear scaling to make differences less extreme
    const targetScale = Math.pow(priceRatio, 0.33) * this.currentData.houseSize;
    
    // Get previous scale for animation
    const prevPriceRatio = (prevData.targetHomePrice || basePrice) / basePrice;
    const prevScale = Math.pow(prevPriceRatio, 0.33) * (prevData.houseSize || 1);
    
    // If scale is very different, animate the transition
    if (Math.abs(targetScale - prevScale) > 0.05) {
      // Create scale animation
      const duration = 800; // ms
      const startTime = Date.now();
      const initialScale = {
        x: this.objects.house.scale.x,
        y: this.objects.house.scale.y,
        z: this.objects.house.scale.z
      };
      
      // Start animation
      const animateScale = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        
        // Use easing function for smooth animation
        const eased = 1 - Math.pow(1 - progress, 3); // cubic ease out
        
        // Calculate current scale
        const currentScale = prevScale + (targetScale - prevScale) * eased;
        
        // Apply scale
        this.objects.house.scale.set(currentScale, currentScale, currentScale);
        this.objects.roof.scale.set(currentScale, currentScale, currentScale);
        
        // Update positions
        const houseHeight = 2 * currentScale;
        this.objects.house.position.y = houseHeight / 2 - 0.5;
        
        const roofHeight = 1.2 * currentScale;
        this.objects.roof.position.y = houseHeight + roofHeight / 2 - 0.5;
        
        // Continue animation until complete
        if (progress < 1) {
          requestAnimationFrame(animateScale);
        }
      };
      
      // Start animation
      animateScale();
    } else {
      // Small change, just apply immediately
      this.objects.house.scale.set(targetScale, targetScale, targetScale);
      this.objects.roof.scale.set(targetScale, targetScale, targetScale);
      
      // Update position to keep the bottom of the house on the ground
      const houseHeight = 2 * targetScale;
      this.objects.house.position.y = houseHeight / 2 - 0.5;
      
      // Update roof position
      const roofHeight = 1.2 * targetScale;
      this.objects.roof.position.y = houseHeight + roofHeight / 2 - 0.5;
    }
    
    // Add shimmer effect to indicate value change
    this.addHouseShimmerEffect();
  }
  
  /**
   * Add shimmer effect to house to highlight changes
   */
  addHouseShimmerEffect() {
    if (!this.objects.house) return;
    
    // Store original material
    const originalHouseMaterial = this.objects.house.material;
    const originalRoofMaterial = this.objects.roof.material;
    
    // Create shimmer material
    const shimmerMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x5465FF,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.8
    });
    
    // Apply shimmer material
    this.objects.house.material = shimmerMaterial;
    
    // Animate back to original material
    setTimeout(() => {
      this.objects.house.material = originalHouseMaterial;
    }, 600);
  }
  
  /**
   * Update DTI visualization based on data with smooth animation
   * @param {Object} prevData - Previous data values for animation
   */
  updateDtiVisualization(prevData = {}) {
    if (!this.objects.dtiBar || !this.objects.maxDtiBar) return;
    
    // Calculate bar heights based on DTI values
    // Maximum is 50% DTI = height 5
    const maxHeight = 5;
    const targetDtiHeight = (this.currentData.dti / 50) * maxHeight;
    const targetMaxDtiHeight = (this.currentData.maxDti / 50) * maxHeight;
    
    // Get previous heights for animation
    const prevDti = prevData.dti || this.currentData.dti;
    const prevMaxDti = prevData.maxDti || this.currentData.maxDti;
    const prevDtiHeight = (prevDti / 50) * maxHeight;
    const prevMaxDtiHeight = (prevMaxDti / 50) * maxHeight;
    
    // If heights are very different, animate the transition
    if (Math.abs(targetDtiHeight - prevDtiHeight) > 0.1 || 
        Math.abs(targetMaxDtiHeight - prevMaxDtiHeight) > 0.1) {
      
      // Create height animation
      const duration = 800; // ms
      const startTime = Date.now();
      
      // Start animation
      const animateHeight = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        
        // Use easing function for smooth animation
        const eased = 1 - Math.pow(1 - progress, 3); // cubic ease out
        
        // Calculate current heights
        const currentDtiHeight = prevDtiHeight + (targetDtiHeight - prevDtiHeight) * eased;
        const currentMaxDtiHeight = prevMaxDtiHeight + (targetMaxDtiHeight - prevMaxDtiHeight) * eased;
        
        // Update bar scales
        this.objects.dtiBar.scale.y = currentDtiHeight;
        this.objects.maxDtiBar.scale.y = currentMaxDtiHeight;
        
        // Update bar positions to keep bottom on the ground
        this.objects.dtiBar.position.y = currentDtiHeight / 2;
        this.objects.maxDtiBar.position.y = currentMaxDtiHeight / 2;
        
        // Update label positions
        this.updateLabelPositions();
        
        // Continue animation until complete
        if (progress < 1) {
          requestAnimationFrame(animateHeight);
        } else {
          // Add particle effect at the top of bars
          this.addBarTopParticles(this.objects.dtiBar.position.clone(), 0x3498db);
          this.addBarTopParticles(this.objects.maxDtiBar.position.clone(), 0xe74c3c);
        }
      };
      
      // Start animation
      animateHeight();
    } else {
      // Small change, just apply immediately
      this.objects.dtiBar.scale.y = targetDtiHeight;
      this.objects.maxDtiBar.scale.y = targetMaxDtiHeight;
      
      this.objects.dtiBar.position.y = targetDtiHeight / 2;
      this.objects.maxDtiBar.position.y = targetMaxDtiHeight / 2;
    }
    
    // Update bar user data
    this.objects.dtiBar.userData.value = this.currentData.dti;
    this.objects.maxDtiBar.userData.value = this.currentData.maxDti;
    
    // Update labels
    if (this.dtiLabel) {
      this.dtiLabel.textContent = `Current DTI: ${this.currentData.dti.toFixed(1)}%`;
      
      // Add subtle animation to highlight changes
      this.dtiLabel.classList.remove('pulse-highlight');
      void this.dtiLabel.offsetWidth; // Force reflow
      this.dtiLabel.classList.add('pulse-highlight');
    }
    if (this.maxDtiLabel) {
      this.maxDtiLabel.textContent = `Max DTI: ${this.currentData.maxDti.toFixed(1)}%`;
      
      // Add subtle animation to highlight changes
      this.maxDtiLabel.classList.remove('pulse-highlight');
      void this.maxDtiLabel.offsetWidth; // Force reflow
      this.maxDtiLabel.classList.add('pulse-highlight');
    }
  }
  
  /**
   * Add particle effect at the top of bars
   * @param {THREE.Vector3} position - Position to add particles
   * @param {number} color - Color of particles
   */
  addBarTopParticles(position, color) {
    // Move position to top of bar
    position.y += 0.1;
    
    // Create particles
    const particleCount = 15;
    const particleGeometry = new THREE.SphereGeometry(0.03, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true
    });
    
    // Create particle group
    const particles = new THREE.Group();
    this.scene.add(particles);
    
    // Create individual particles
    for (let i = 0; i < particleCount; i++) {
      const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());
      particle.position.copy(position);
      
      // Add random velocity
      particle.userData.velocity = {
        x: (Math.random() - 0.5) * 0.05,
        y: Math.random() * 0.1,
        z: (Math.random() - 0.5) * 0.05
      };
      
      particles.add(particle);
    }
    
    // Animate particles
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / 1000);
      
      // Update each particle
      particles.children.forEach((particle, index) => {
        // Update position
        particle.position.x += particle.userData.velocity.x;
        particle.position.y += particle.userData.velocity.y;
        particle.position.z += particle.userData.velocity.z;
        
        // Add gravity
        particle.userData.velocity.y -= 0.003;
        
        // Update opacity
        particle.material.opacity = 1 - progress;
      });
      
      // Continue animation until complete
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Remove particles
        particles.children.forEach(particle => {
          particle.geometry.dispose();
          particle.material.dispose();
        });
        this.scene.remove(particles);
      }
    };
    
    // Start animation
    animate();
  }
  
  /**
   * Update info panel content
   */
  updateInfoPanel() {
    // Update info panel content based on current visualization mode
    if (!this.infoPanel) return;
    
    // Update basic info
    document.getElementById('info-house-price').textContent = 
      `$${this.formatNumber(this.currentData.targetHomePrice)}`;
    document.getElementById('info-down-payment').textContent = 
      `$${this.formatNumber(this.currentData.downPayment)} (${this.currentData.downPaymentPercent}%)`;
    document.getElementById('info-monthly-income').textContent = 
      `$${this.formatNumber(this.currentData.monthlyIncome)}`;
    
    // Show info panel
    this.infoPanel.classList.add('visible');
  }
  
  /**
   * Show controls panel
   */
  showControls() {
    if (!this.controlsPanel) return;
    this.controlsPanel.classList.add('visible');
  }
  
  /**
   * Format number with commas for thousands
   * @param {number} value - Number to format
   * @returns {string} Formatted number
   */
  formatNumber(value) {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  
  /**
   * Connect to mortgage data collection as data source with form coordination
   * @param {MortgageDataCollection} dataSource - Data source
   */
  connectDataSource(dataSource) {
    this.dataSource = dataSource;
    
    // Set up data update handlers
    if (this.dataSource) {
      // Listen for data changes from the sheet
      if (typeof this.dataSource.registerVisualization === 'function') {
        this.dataSource.registerVisualization(this);
      } else {
        // If the registration function doesn't exist, set up manual event listeners
        this.dataSource.sheetController.onPositionChange((position) => {
          // Only show visualization when sheet is active
          if (position === 'closed') {
            // When sheet is closed, optionally hide some elements
            this.setVisualizationMode('house');
          } else {
            // Show 3D visualization when sheet is opened
            this.show();
          }
        });
        
        // Listen for calculation events
        document.addEventListener('mortgage-data-updated', (event) => {
          if (event.detail && event.detail.data) {
            this.updateData(event.detail.data);
          }
        });
      }
      
      // Listen for form transitions to coordinate 3D animation
      document.addEventListener('form-transition', (event) => {
        if (event.detail) {
          this.handleFormTransition(event.detail.event, event.detail);
        }
      });
      
      // Initialize with any existing data
      if (this.dataSource.data) {
        const initialData = {
          targetHomePrice: parseFloat(this.dataSource.data.targetHomePrice) || 250000,
          downPayment: parseFloat(this.dataSource.data.downPayment) || 50000,
          downPaymentPercent: parseFloat(this.dataSource.data.downPaymentPercent) || 20,
          monthlyIncome: parseFloat(this.dataSource.data.monthlyIncome) || 5000,
          dti: this.dataSource.calculatedDti || 36,
          maxDti: this.dataSource.calculatedMaxDti || 43
        };
        
        // Update visualization with initial data
        this.updateData(initialData);
      }
      
      // Show visualization after a short delay
      setTimeout(() => {
        this.show();
      }, 800);
    }
  }
  
  /**
   * Handle form transitions to coordinate 3D animations
   * @param {string} event - Transition event type
   * @param {Object} data - Additional data
   */
  handleFormTransition(event, data) {
    if (!this.interactionEnabled) return;
    
    // Add transition class to container
    const container = document.querySelector('.visualization-container');
    container.classList.add('form-transition');
    
    // Handle specific transition events
    switch (event) {
      case 'page-next-start':
      case 'page-prev-start':
        // Add subtle camera movement for page transitions
        this.addCameraReactionAnimation(event === 'page-next-start' ? 'right' : 'left');
        break;
        
      case 'section-change-start':
        // For section changes, do more significant transitions
        if (data.direction === 'forward') {
          // Move camera more dramatically
          this.addCameraReactionAnimation('forward', 1.5);
          
          // Change lighting to emphasize transition
          this.addLightingTransition();
        } else {
          // Moving backward
          this.addCameraReactionAnimation('backward', 1.5);
          
          // Change lighting to emphasize transition
          this.addLightingTransition();
        }
        
        // Visual transition based on sections
        this.reactToSectionChange(data.from, data.to);
        break;
        
      case 'page-next-end':
      case 'page-prev-end':
      case 'section-change-end':
        // Remove transition class
        setTimeout(() => {
          container.classList.remove('form-transition');
        }, 300);
        break;
    }
  }
  
  /**
   * Add subtle camera reaction to form transitions
   * @param {string} direction - Direction of transition
   * @param {number} intensity - Animation intensity factor
   */
  addCameraReactionAnimation(direction, intensity = 1.0) {
    // Store current camera position
    const currentPos = {
      x: this.camera.position.x,
      y: this.camera.position.y,
      z: this.camera.position.z
    };
    
    // Calculate offset based on direction
    let offsetX = 0, offsetY = 0, offsetZ = 0;
    
    switch (direction) {
      case 'left':
        offsetX = -0.3 * intensity;
        break;
      case 'right':
        offsetX = 0.3 * intensity;
        break;
      case 'forward':
        offsetZ = -0.4 * intensity;
        offsetY = 0.1 * intensity;
        break;
      case 'backward':
        offsetZ = 0.4 * intensity;
        offsetY = -0.1 * intensity;
        break;
    }
    
    // Create target positions for animation
    const midPos = {
      x: currentPos.x + offsetX,
      y: currentPos.y + offsetY,
      z: currentPos.z + offsetZ
    };
    
    // Animate camera in two phases
    // Phase 1: Move in reaction direction
    const duration1 = 300;
    const startTime1 = Date.now();
    
    const animate1 = () => {
      const elapsed = Date.now() - startTime1;
      const progress = Math.min(1, elapsed / duration1);
      
      // Use easeOutQuad for natural feel
      const eased = 1 - Math.pow(1 - progress, 2);
      
      // Update camera position
      this.camera.position.x = currentPos.x + (midPos.x - currentPos.x) * eased;
      this.camera.position.y = currentPos.y + (midPos.y - currentPos.y) * eased;
      this.camera.position.z = currentPos.z + (midPos.z - currentPos.z) * eased;
      
      // Look at center
      this.camera.lookAt(0, 0, 0);
      
      if (progress < 1) {
        requestAnimationFrame(animate1);
      } else {
        // Phase 2: Return to original position
        const duration2 = 500;
        const startTime2 = Date.now();
        
        const animate2 = () => {
          const elapsed = Date.now() - startTime2;
          const progress = Math.min(1, elapsed / duration2);
          
          // Use easeOutElastic for springy return
          const eased = this.elasticOut(progress);
          
          // Update camera position
          this.camera.position.x = midPos.x + (currentPos.x - midPos.x) * eased;
          this.camera.position.y = midPos.y + (currentPos.y - midPos.y) * eased;
          this.camera.position.z = midPos.z + (currentPos.z - midPos.z) * eased;
          
          // Look at center
          this.camera.lookAt(0, 0, 0);
          
          if (progress < 1) {
            requestAnimationFrame(animate2);
          }
        };
        
        animate2();
      }
    };
    
    animate1();
  }
  
  /**
   * Add lighting transition effect for form transitions
   */
  addLightingTransition() {
    // Get directional light or create a new one for the transition
    let transitionLight;
    
    // Try to find existing transition light
    this.scene.traverse((object) => {
      if (object.isDirectionalLight && object.name === 'transitionLight') {
        transitionLight = object;
      }
    });
    
    // Create new light if none exists
    if (!transitionLight) {
      transitionLight = new THREE.DirectionalLight(0xffffff, 0);
      transitionLight.name = 'transitionLight';
      transitionLight.position.set(-5, 8, -3);
      this.scene.add(transitionLight);
    }
    
    // Animate light intensity
    const duration = 800;
    const peakIntensity = 1.5;
    const startTime = Date.now();
    
    // Reset any existing animation
    transitionLight.intensity = 0;
    
    const animateLight = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Calculate intensity with peak in the middle
      if (progress < 0.5) {
        // Fade in
        transitionLight.intensity = peakIntensity * (progress * 2);
      } else {
        // Fade out
        transitionLight.intensity = peakIntensity * (1 - (progress - 0.5) * 2);
      }
      
      if (progress < 1) {
        requestAnimationFrame(animateLight);
      } else {
        // End animation
        transitionLight.intensity = 0;
      }
    };
    
    // Start animation
    animateLight();
  }
  
  /**
   * React to section changes with appropriate visual transitions
   * @param {string} fromSection - Previous form section
   * @param {string} toSection - New form section
   */
  reactToSectionChange(fromSection, toSection) {
    // Map sections to visualization modes
    const sectionToMode = {
      'goals-income': 'house',
      'debt-housing': 'house',
      'credit-assets': 'dti',
      'payment-medical': 'affordability'
    };
    
    // Get target visualization mode for new section
    const targetMode = sectionToMode[toSection] || 'house';
    
    // Transition visualization mode with delay to coordinate with form animation
    setTimeout(() => {
      this.setVisualizationMode(targetMode);
    }, 200);
    
    // Add specific effects based on section transition
    if (fromSection === 'goals-income' && toSection === 'debt-housing') {
      // Transitioning to debt section - emphasize house with glow effect
      this.addGlowEffectToObject(this.objects.house, 0x3498db);
    } else if (fromSection === 'debt-housing' && toSection === 'credit-assets') {
      // Transitioning to credit section - show DTI bars with dramatic entry
      this.addEnhancedBarEntryAnimation();
    } else if (fromSection === 'credit-assets' && toSection === 'payment-medical') {
      // Transitioning to payment history - show affordability visualization
      this.addAffordabilityTransitionEffect();
    }
  }
  
  /**
   * Add glow effect to a 3D object
   * @param {THREE.Object3D} object - Object to add glow to
   * @param {number} color - Color of glow
   */
  addGlowEffectToObject(object, color) {
    if (!object || !object.material) return;
    
    // Store original material
    const originalMaterial = object.material.clone();
    
    // Create glow material
    const glowMaterial = originalMaterial.clone();
    if (glowMaterial.emissive) {
      glowMaterial.emissive.set(color);
      glowMaterial.emissiveIntensity = 0;
    }
    
    // Apply glow material
    object.material = glowMaterial;
    
    // Animate glow intensity
    const duration = 1500;
    const startTime = Date.now();
    
    const animateGlow = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Calculate intensity with peak in the middle
      let intensity;
      if (progress < 0.3) {
        // Fade in
        intensity = progress / 0.3;
      } else if (progress < 0.7) {
        // Hold at max
        intensity = 1;
      } else {
        // Fade out
        intensity = 1 - ((progress - 0.7) / 0.3);
      }
      
      // Apply intensity
      if (glowMaterial.emissive) {
        glowMaterial.emissiveIntensity = intensity * 0.5;
      }
      
      if (progress < 1) {
        requestAnimationFrame(animateGlow);
      } else {
        // Restore original material
        object.material = originalMaterial;
      }
    };
    
    // Start animation
    animateGlow();
  }
  
  /**
   * Add enhanced entry animation for DTI bars
   */
  addEnhancedBarEntryAnimation() {
    if (!this.dtiGroup) return;
    
    // Ensure DTI group is visible
    this.dtiGroup.visible = true;
    
    // Hide existing bars
    if (this.objects.dtiBar) {
      this.objects.dtiBar.visible = false;
    }
    if (this.objects.maxDtiBar) {
      this.objects.maxDtiBar.visible = false;
    }
    
    // Calculate target heights
    const maxHeight = 5;
    const dtiHeight = (this.currentData.dti / 50) * maxHeight;
    const maxDtiHeight = (this.currentData.maxDti / 50) * maxHeight;
    
    // Create ground ripple effect
    this.addGroundRippleEffect(new THREE.Vector3(-1, 0, 0), 0x3498db);
    
    // Add delay for second ripple
    setTimeout(() => {
      this.addGroundRippleEffect(new THREE.Vector3(1, 0, 0), 0xe74c3c);
    }, 200);
    
    // Create growing bars with delay
    setTimeout(() => {
      // Show the bars
      if (this.objects.dtiBar) {
        this.objects.dtiBar.visible = true;
        this.objects.dtiBar.scale.y = 0.01;
        this.objects.dtiBar.position.y = 0.005;
      }
      
      // Animate current DTI bar
      this.animateBarGrowth(this.objects.dtiBar, dtiHeight, 1000, 0x3498db);
      
      // Animate max DTI bar with delay
      setTimeout(() => {
        if (this.objects.maxDtiBar) {
          this.objects.maxDtiBar.visible = true;
          this.objects.maxDtiBar.scale.y = 0.01;
          this.objects.maxDtiBar.position.y = 0.005;
        }
        
        this.animateBarGrowth(this.objects.maxDtiBar, maxDtiHeight, 1000, 0xe74c3c);
      }, 300);
      
      // Show labels after bars grow
      setTimeout(() => {
        if (this.dtiLabel) this.dtiLabel.style.opacity = '1';
        if (this.maxDtiLabel) this.maxDtiLabel.style.opacity = '1';
        this.updateLabelPositions();
      }, 1000);
    }, 500);
  }
  
  /**
   * Animate bar growth with dramatic effect
   * @param {THREE.Mesh} bar - Bar to animate
   * @param {number} targetHeight - Target height
   * @param {number} duration - Animation duration
   * @param {number} particleColor - Color for particles
   */
  animateBarGrowth(bar, targetHeight, duration, particleColor) {
    if (!bar) return;
    
    const startTime = Date.now();
    
    const animateBar = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Use elastic easing for more dramatic effect
      const eased = this.elasticOut(progress);
      
      // Update bar scale
      bar.scale.y = 0.01 + (targetHeight - 0.01) * eased;
      
      // Update position
      bar.position.y = bar.scale.y / 2;
      
      // Update label positions
      this.updateLabelPositions();
      
      if (progress < 1) {
        requestAnimationFrame(animateBar);
      } else {
        // Ensure final values
        bar.scale.y = targetHeight;
        bar.position.y = targetHeight / 2;
        
        // Add finishing particles
        this.addBarTopParticles(bar.position.clone(), particleColor);
      }
    };
    
    // Start animation
    animateBar();
  }
  
  /**
   * Add ground ripple effect at position
   * @param {THREE.Vector3} position - Ripple position
   * @param {number} color - Ripple color
   */
  addGroundRippleEffect(position, color) {
    // Create ripple geometries at different sizes
    const ripples = [];
    const rippleCount = 3;
    const duration = 1500;
    
    for (let i = 0; i < rippleCount; i++) {
      const innerRadius = 0.05 + (i * 0.05);
      const outerRadius = innerRadius + 0.1;
      
      const rippleGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 32);
      const rippleMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
      });
      
      const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
      ripple.position.copy(position);
      ripple.position.y = 0.02;
      ripple.rotation.x = -Math.PI / 2;
      ripple.scale.set(0.1, 0.1, 1);
      
      // Add to scene
      this.scene.add(ripple);
      ripples.push({
        mesh: ripple,
        material: rippleMaterial,
        delay: i * 200
      });
    }
    
    // Animate ripples
    ripples.forEach(ripple => {
      setTimeout(() => {
        const startTime = Date.now();
        
        const animateRipple = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(1, elapsed / duration);
          
          // Scale up ripple
          ripple.mesh.scale.x = 0.1 + progress * 5;
          ripple.mesh.scale.y = 0.1 + progress * 5;
          
          // Fade out gradually
          ripple.material.opacity = 0.7 * (1 - progress);
          
          if (progress < 1) {
            requestAnimationFrame(animateRipple);
          } else {
            // Remove ripple
            this.scene.remove(ripple.mesh);
            ripple.mesh.geometry.dispose();
            ripple.material.dispose();
          }
        };
        
        // Start ripple animation
        animateRipple();
      }, ripple.delay);
    });
  }
  
  /**
   * Add affordability transition effect
   */
  addAffordabilityTransitionEffect() {
    // Create or ensure affordability visualization
    if (!this.affordabilityVisualization && this.currentData.maxMonthlyPayment) {
      setTimeout(() => {
        this.createAffordabilityVisualization();
        
        // Show with dramatic animation
        if (this.affordabilityGroup) {
          // Initially hide group
          this.affordabilityGroup.visible = false;
          
          // Show after delay
          setTimeout(() => {
            this.affordabilityGroup.visible = true;
            this.affordabilityGroup.scale.set(0.1, 0.1, 0.1);
            
            // Scale up with elastic effect
            const duration = 1200;
            const startTime = Date.now();
            
            const animateGroup = () => {
              const elapsed = Date.now() - startTime;
              const progress = Math.min(1, elapsed / duration);
              
              // Use elastic out easing
              const eased = this.elasticOut(progress);
              
              // Update scale
              this.affordabilityGroup.scale.set(
                0.1 + 0.9 * eased,
                0.1 + 0.9 * eased,
                0.1 + 0.9 * eased
              );
              
              if (progress < 1) {
                requestAnimationFrame(animateGroup);
              } else {
                // Show particles and flowing lines after animation
                this.affordabilityGroup.scale.set(1, 1, 1);
                
                // Show labels
                setTimeout(() => {
                  if (this.affordabilityLabel) {
                    this.affordabilityLabel.style.opacity = '1';
                  }
                }, 300);
              }
            };
            
            // Start animation
            animateGroup();
          }, 500);
        }
      }, 300);
    } else if (this.affordabilityGroup) {
      // Already exists, just highlight it
      this.addGlowEffectToObject(this.objects.paymentCylinder, 0x2ecc71);
    }
  }
  
  /**
   * Update visualization with new data
   * @param {Object} data - Mortgage data
   */
  updateData(data) {
    // Store previous data for animation
    const prevData = { ...this.currentData };
    
    // Update data with new values
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined) {
        this.currentData[key] = data[key];
      }
    });
    
    // Add visual ripple effect to show data change
    this.addDataChangeRipple();
    
    // Update visualizations with smooth transitions
    this.updateHouseScale(prevData);
    this.updateDtiVisualization(prevData);
    this.updateInfoPanel();
    this.updateLabelPositions();
    
    // Dispatch event that visualization was updated
    const event = new CustomEvent('visualization-updated', {
      detail: { data: this.currentData }
    });
    document.dispatchEvent(event);
  }
  
  /**
   * Add ripple effect to visualize data change
   */
  addDataChangeRipple() {
    // Create ripple geometry
    const rippleGeometry = new THREE.RingGeometry(0.1, 0.2, 32);
    const rippleMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    
    // Create ripple mesh
    const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
    ripple.position.y = 0.05;
    ripple.rotation.x = -Math.PI / 2;
    this.scene.add(ripple);
    
    // Animate ripple
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / 1000);
      
      // Scale up
      ripple.scale.set(1 + progress * 10, 1 + progress * 10, 1);
      
      // Fade out
      rippleMaterial.opacity = 0.7 * (1 - progress);
      
      // Continue animation until complete
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Remove ripple
        this.scene.remove(ripple);
        rippleGeometry.dispose();
        rippleMaterial.dispose();
      }
    };
    
    // Start animation
    animate();
  }
  
  /**
   * Show visualization with dynamic entrance animation
   */
  show() {
    // Only run full animation if not already shown
    const isFirstShow = !this.overlay.classList.contains('faded');
    
    // Fade out overlay
    this.overlay.classList.add('faded');
    
    if (isFirstShow) {
      // Create dramatic entrance animation
      
      // First, reset camera to a higher position
      this.camera.position.set(0, 10, 20);
      this.camera.lookAt(0, 0, 0);
      
      // Animate camera sweeping in
      const cameraAnimation = {
        startPosition: { x: 0, y: 10, z: 20 },
        endPosition: { x: 0, y: 3, z: 8 },
        startTime: Date.now(),
        duration: 2000
      };
      this.cameraAnimation = cameraAnimation;
      
      // Add some environment light effects
      const spotLight = new THREE.SpotLight(0xffffff, 2);
      spotLight.position.set(0, 10, 0);
      spotLight.angle = Math.PI / 6;
      spotLight.penumbra = 0.5;
      spotLight.decay = 2;
      spotLight.distance = 50;
      spotLight.target = this.objects.house;
      this.scene.add(spotLight);
      
      // Animate spotlight
      const startTime = Date.now();
      const animateLight = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / 2000);
        
        // Fade out light
        spotLight.intensity = 2 * (1 - progress);
        
        if (progress < 1) {
          requestAnimationFrame(animateLight);
        } else {
          this.scene.remove(spotLight);
        }
      };
      animateLight();
      
      // Add ground ripple effect
      this.addDataChangeRipple();
      
      // Show controls with cascade effect
      setTimeout(() => {
        this.showControls();
        
        setTimeout(() => {
          this.infoPanel.classList.add('visible');
          
          // Enable interactions
          this.interactionEnabled = true;
          
          // Add interactive indicator
          setTimeout(() => {
            this.addInteractiveIndicator();
          }, 500);
        }, 300);
      }, 1500);
    } else {
      // Simpler animation for subsequent shows
      this.showControls();
      this.infoPanel.classList.add('visible');
      
      // Enable interactions
      this.interactionEnabled = true;
    }
  }
  
  /**
   * Add interactive indicator to encourage user interaction
   */
  addInteractiveIndicator() {
    // Check if indicator already exists
    if (document.querySelector('.scene-interactive-indicator')) {
      document.querySelector('.scene-interactive-indicator').classList.add('visible');
      return;
    }
    
    // Create indicator
    const indicator = document.createElement('div');
    indicator.className = 'scene-interactive-indicator';
    indicator.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 15s-2 2-5 2-5-2-5-2"/>
        <path d="M12 12v-2"/>
        <path d="M12 9V7"/>
        <circle cx="12" cy="12" r="9"/>
      </svg>
      <span>Click objects to interact</span>
    `;
    
    // Add to container
    document.querySelector('.visualization-container').appendChild(indicator);
    
    // Show indicator
    setTimeout(() => {
      indicator.classList.add('visible');
      
      // Hide after 5 seconds
      setTimeout(() => {
        indicator.classList.remove('visible');
      }, 5000);
    }, 500);
  }
  
  /**
   * Hide visualization and show overlay
   */
  hide() {
    // Fade in overlay
    this.overlay.classList.remove('faded');
    
    // Hide controls
    this.controlsPanel.classList.remove('visible');
    this.infoPanel.classList.remove('visible');
    
    // Disable interactions
    this.interactionEnabled = false;
  }
}
