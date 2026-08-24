"""Authoritative Delhi boundary used by the optional grid-generation pipeline."""

from geoalchemy2 import Geometry
from sqlalchemy import Column, DateTime, Integer, Index, String, func

from app.database import Base


class DelhiBoundary(Base):
    """One official NCT Delhi boundary geometry in WGS84."""

    __tablename__ = "delhi_boundary"

    boundary_id = Column(Integer, primary_key=True, default=1)
    geom = Column(Geometry(geometry_type="GEOMETRY", srid=4326), nullable=False)
    source = Column(String(255), nullable=False, default="data/raw/delhi_boundary.geojson")
    imported_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_delhi_boundary_geom", "geom", postgresql_using="gist"),
    )
