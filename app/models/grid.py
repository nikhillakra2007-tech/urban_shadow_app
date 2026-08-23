from geoalchemy2 import Geometry
from sqlalchemy import Column, Float, Index, Integer
from sqlalchemy.orm import relationship

from app.database import Base


class UrbanGridMaster(Base):
    """GRID - the master table. One row per 500m grid cell.

    This is the hub: every other table links here via grid_id.
    """

    __tablename__ = "urban_grid_master"

    grid_id = Column(Integer, primary_key=True, autoincrement=True)

    # GRID
    geom = Column(Geometry(geometry_type="GEOMETRY", srid=3857), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    heat = relationship("Heat", back_populates="grid", uselist=False)
    vegetation = relationship("Vegetation", back_populates="grid", uselist=False)
    weather = relationship("Weather", back_populates="grid", uselist=False)
    terrain = relationship("Terrain", back_populates="grid", uselist=False)
    air = relationship("Air", back_populates="grid", uselist=False)
    population = relationship("Population", back_populates="grid", uselist=False)
    night = relationship("Night", back_populates="grid", uselist=False)
    water = relationship("Water", back_populates="grid", uselist=False)
    roads = relationship("Roads", back_populates="grid", uselist=False)
    traffic = relationship("Traffic", back_populates="grid", uselist=False)
    vehicles = relationship("Vehicles", back_populates="grid", uselist=False)
    walkability = relationship("Walkability", back_populates="grid", uselist=False)
    buildings = relationship("Buildings", back_populates="grid", uselist=False)
    green = relationship("Green", back_populates="grid", uselist=False)
    drainage = relationship("Drainage", back_populates="grid", uselist=False)
    public_transport = relationship("PublicTransport", back_populates="grid", uselist=False)
    essential_services = relationship("EssentialServices", back_populates="grid", uselist=False)
    commercial = relationship("Commercial", back_populates="grid", uselist=False)
    scores = relationship("UrbanScore", back_populates="grid", uselist=False)

    __table_args__ = (
        Index("idx_urban_grid_master_geom", "geom", postgresql_using="gist"),
    )