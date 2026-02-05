# Patch triton imports for macOS compatibility (must be before any SAM3 imports)
import sys
import types

# Create comprehensive triton stub if not available (for macOS compatibility)
if 'triton' not in sys.modules:
    # Helper to create a stub module that acts as both module and package
    def create_stub_module(name, is_package=False):
        mod = types.ModuleType(name)
        mod.__file__ = '<triton_stub>'
        if is_package:
            mod.__path__ = []
        return mod
    
    # Create main triton package
    triton = create_stub_module('triton', is_package=True)
    
    # Create triton.language module with common attributes
    tl = create_stub_module('triton.language')
    tl.constexpr = lambda x=None: x if x is not None else (lambda f: f)
    tl.program_id = lambda axis: 0
    tl.num_programs = lambda axis: 1
    tl.load = lambda *a, **kw: None
    tl.store = lambda *a, **kw: None
    tl.arange = lambda *a, **kw: None
    tl.zeros = lambda *a, **kw: None
    tl.cdiv = lambda a, b: (a + b - 1) // b
    tl.sigmoid = lambda x: x
    tl.log = lambda x: x
    tl.exp = lambda x: x
    tl.abs = lambda x: x
    tl.clamp = lambda x, **kw: x
    tl.cast = lambda x, t: x
    tl.reduce = lambda *a, **kw: None
    tl.debug_barrier = lambda: None
    tl.tensor = type('tensor', (), {})
    tl.int1 = 'int1'
    tl.int32 = 'int32'
    tl.int64 = 'int64'
    tl.uint8 = 'uint8'
    tl.uint32 = 'uint32'
    tl.float16 = 'float16'
    tl.float32 = 'float32'
    tl.bool = 'bool'
    # dtype class for type annotations
    class dtype:
        float32 = 'float32'
        float16 = 'float16'
        int32 = 'int32'
        int64 = 'int64'
        uint8 = 'uint8'
        uint32 = 'uint32'
        bool = 'bool'
    tl.dtype = dtype
    triton.language = tl
    
    # Create triton.compiler package and submodules
    compiler_pkg = create_stub_module('triton.compiler', is_package=True)
    compiler_compiler = create_stub_module('triton.compiler.compiler')
    compiler_compiler.CompiledKernel = type('CompiledKernel', (), {})
    compiler_compiler.compile = lambda *a, **kw: lambda f: f
    compiler_pkg.compiler = compiler_compiler
    compiler_pkg.CompiledKernel = compiler_compiler.CompiledKernel
    compiler_pkg.compile = compiler_compiler.compile
    triton.compiler = compiler_pkg
    
    # Create triton.backends package and submodules
    backends_pkg = create_stub_module('triton.backends', is_package=True)
    backends_compiler = create_stub_module('triton.backends.compiler')
    backends_compiler.compile = lambda *a, **kw: lambda f: f
    backends_pkg.compiler = backends_compiler
    triton.backends = backends_pkg
    
    # Create triton.runtime module
    runtime = create_stub_module('triton.runtime', is_package=True)
    runtime.driver = create_stub_module('triton.runtime.driver')
    runtime.jit = create_stub_module('triton.runtime.jit')
    triton.runtime = runtime
    
    # Kernel callable class for @triton.jit decorated functions
    class KernelStub:
        def __init__(self, func):
            self.func = func
        def __getitem__(self, grid):
            def launcher(*args, **kwargs):
                pass  # No-op on CPU
            return launcher
        def __call__(self, *args, **kwargs):
            pass
    
    # @triton.jit decorator
    def jit(*args, **kwargs):
        def decorator(func):
            return KernelStub(func)
        if args and callable(args[0]):
            return KernelStub(args[0])
        return decorator
    triton.jit = jit
    
    # @triton.autotune decorator
    def autotune(*args, **kwargs):
        def decorator(func):
            return func
        if args and callable(args[0]):
            return args[0]
        return decorator
    triton.autotune = autotune
    
    # triton.Config class
    class Config:
        def __init__(self, kwargs=None, **kw):
            if kwargs:
                self.__dict__.update(kwargs)
            self.__dict__.update(kw)
    triton.Config = Config
    
    # Register ALL modules in sys.modules
    sys.modules['triton'] = triton
    sys.modules['triton.language'] = tl
    sys.modules['triton.compiler'] = compiler_pkg
    sys.modules['triton.compiler.compiler'] = compiler_compiler
    sys.modules['triton.backends'] = backends_pkg
    sys.modules['triton.backends.compiler'] = backends_compiler
    sys.modules['triton.runtime'] = runtime
    sys.modules['triton.runtime.driver'] = runtime.driver
    sys.modules['triton.runtime.jit'] = runtime.jit

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import detection

app = FastAPI(title="SAM3 Detection API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(detection.router, prefix="/api", tags=["detection"])


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    from app.services.sam3_service import SAM3Service
    
    try:
        service = SAM3Service.get_instance()
        model_loaded = service.is_model_loaded()
        return {
            "status": "healthy",
            "model_loaded": model_loaded
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }
