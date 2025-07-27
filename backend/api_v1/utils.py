def get_db(CyberDB):
    """Get CyberDB instance"""
    if CyberDB is None:
        return None
    return CyberDB.from_default_config()