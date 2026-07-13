# Changelog

All notable changes to the DDN INFINIA RAG Demo will be documented in this file.

## [2.1.4] - 2026-02-08

### Added
- **Real Benchmark Endpoints**: Implemented functional storage benchmark tests
  - `POST /api/benchmarks/basic` - Runs 10 real upload/download tests
  - `POST /api/benchmarks/multi-size` - Tests 4 chunk sizes (1KB to 1MB)
  - Replaced fake/simulated test buttons with actual storage operations
  - Benchmarks perform real uploads to DDN INFINIA and AWS (or 35x simulated AWS)

- **Enhanced Performance Metrics in RAG Chat**
  - Added "DDN Total" and "AWS Total" time metrics
  - Performance grid expanded from 5 to 7 columns
  - Shows both TTFB and total query time for complete performance picture

### Changed
- **About Page UI Improvements**
  - Replaced specific performance numbers (70%, 50%, 10x, 3x, 90%) with generic value propositions
  - Changed "Dramatically", "Significantly", "Rapid", "Enhanced", "Exceptional", "Unlimited"
  - Fixed layout by switching from horizontal to vertical stacking for value cards
  - Changed "sub-100ms responses" to "lightning-fast responses"

### Fixed
- **Dashboard TTFB Display Bug**
  - Fixed incorrect TTFB values showing 806446ms instead of 806ms (1000x error)
  - Root cause: Double unit conversion in `get_retrieval_summary()`
  - Removed incorrect `* 1000` multiplication (values already in milliseconds)

- **Benchmark Endpoints 404 Error**
  - Fixed missing `benchmarks_router` registration in `main.py`
  - Added router import and `app.include_router()` call

### Security
- Cleared storage credentials from `backend/data/storage_config.json`
- Empty credential templates ensure no sensitive data in repository

### Technical Details
- Backend benchmark endpoints use real S3 operations via `S3Handler`
- Maintains 35x multiplier for AWS simulation when credentials not configured
- All benchmark results include `aws_simulated` flag for transparency
- TTFB metrics calculation corrected in `metrics.py`

---

## [2.1.3] - Previous Release
- Continuous ingestion monitoring
- Performance dashboard with LLM metrics
- NVIDIA NeMo integration

---

## [2.1.2] - Initial Tagged Release
- Base RAG application
- DDN INFINIA vs AWS S3 comparison
- Document upload and chat functionality
