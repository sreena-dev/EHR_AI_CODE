# Apply monkey-patches for environment compatibility IMMEDIATELY on import
try:
    import inspect
    
    _original_getmodule = inspect.getmodule    
    
    def _safe_getmodule(object, _filename=None):
        try:
            return _original_getmodule(object, _filename)
        except AttributeError:
            # Catch "builtin type swigvarlink has no __module__ attribute"
            if "swigvarlink" in str(type(object)) or "swigvarlink" in str(object):
                return None
            raise
    
    # Apply the patch
    inspect.getmodule = _safe_getmodule
    
except ImportError:
    pass

def pytest_configure(config):
    pass
