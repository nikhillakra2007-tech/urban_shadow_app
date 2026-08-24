from sqlalchemy import Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base

FK = "urban_grid_master.grid_id"


class Heat(Base):
    """HEAT group - one row per grid cell (PK = grid_id)."""

    __tablename__ = "heat"

    grid_id = Column(Integer, ForeignKey(FK), primary_key=True)
    lst_mean = Column(Float)
    lst_summer_mean = Column(Float)

    grid = relationship("UrbanGridMaster", back_populates="heat")


class Vegetation(Base):
    """VEGETATION group."""

    __tablename__ = "vegetation"

    grid_id = Column(Integer, ForeignKey(FK), primary_key=True)
    ndvi_mean = Column(Float)
    builtup_percentage = Column(Float)
    landcover_class = Column(String(50))

    grid = relationship("UrbanGridMaster", back_populates="vegetation")


class Weather(Base):
    """WEATHER group."""

    __tablename__ = "weather"

    grid_id = Column(Integer, ForeignKey(FK), primary_key=True)
    humidity = Column(Float)
    wind_speed = Column(Float)
    annual_rainfall = Column(Float)
    max_day_rainfall = Column(Float)
    max_monsoon_rainfall = Column(Float)

    grid = relationship("UrbanGridMaster", back_populates="weather")


class Terrain(Base):
    """TERRAIN group."""

    __tablename__ = "terrain"

    grid_id = Column(Integer, ForeignKey(FK), primary_key=True)
    elevation_mean = Column(Float)
    elevation_min = Column(Float)
    elevation_max = Column(Float)

    grid = relationship("UrbanGridMaster", back_populates="terrain")


class Air(Base):
    """AIR group."""

    __tablename__ = "air"

    grid_id = Column(Integer, ForeignKey(FK), primary_key=True)
    pm25 = Column(Float)
    pm10 = Column(Float)
    no2 = Column(Float)
    o3 = Column(Float)

    grid = relationship("UrbanGridMaster", back_populates="air")


class Population(Base):
    """POPULATION group."""

    __tablename__ = "population"

    grid_id = Column(Integer, ForeignKey(FK), primary_key=True)
    population = Column(Float)
    population_density = Column(Float)

    grid = relationship("UrbanGridMaster", back_populates="population")


class Night(Base):
    """NIGHT group."""

    __tablename__ = "night"

    grid_id = Column(Integer, ForeignKey(FK), primary_key=True)
    nightlight_mean = Column(Float)

    grid = relationship("UrbanGridMaster", back_populates="night")


class Water(Base):
    """WATER group."""

    __tablename__ = "water"

    grid_id = Column(Integer, ForeignKey(FK), primary_key=True)
    water_occurrence = Column(Float)
    surface_water_occurrence = Column(Float)

    grid = relationship("UrbanGridMaster", back_populates="water")


class Roads(Base):
    """ROADS group."""

    __tablename__ = "roads"

    grid_id = Column(Integer, ForeignKey(FK), primary_key=True)
    road_length_km = Column(Float)
    major_road_length_km = Column(Float)
    intersection_count = Column(Float)

    grid = relationship("UrbanGridMaster", back_populates="roads")


class Traffic(Base):
    """TRAFFIC group."""

    __tablename__ = "traffic"

    grid_id = Column(Integer, ForeignKey(FK), primary_key=True)
    traffic_signal_count = Column(Float)

    grid = relationship("UrbanGridMaster", back_populates="traffic")


class Vehicles(Base):
    """VEHICLES group."""

    __tablename__ = "vehicles"

    grid_id = Column(Integer, ForeignKey(FK), primary_key=True)
    parking_count = Column(Float)
    fuel_station_count = Column(Float)

    grid = relationship("UrbanGridMaster", back_populates="vehicles")


class Walkability(Base):
    """WALKABILITY group."""

    __tablename__ = "walkability"

    grid_id = Column(Integer, ForeignKey(FK), primary_key=True)
    footway_length_km = Column(Float)
    cycleway_length_km = Column(Float)
    crossing_count = Column(Float)
    pedestrian_area_km2 = Column(Float)
    steps_count = Column(Float)

    grid = relationship("UrbanGridMaster", back_populates="walkability")


class Buildings(Base):
    """BUILDINGS group."""

    __tablename__ = "buildings"

    grid_id = Column(Integer, ForeignKey(FK), primary_key=True)
    building_count = Column(Float)
    building_area_km2 = Column(Float)

    grid = relationship("UrbanGridMaster", back_populates="buildings")


class Green(Base):
    """GREEN group."""

    __tablename__ = "green"

    grid_id = Column(Integer, ForeignKey(FK), primary_key=True)
    park_area_km2 = Column(Float)

    grid = relationship("UrbanGridMaster", back_populates="green")


class Drainage(Base):
    """DRAINAGE group."""

    __tablename__ = "drainage"

    grid_id = Column(Integer, ForeignKey(FK), primary_key=True)
    drain_length_km = Column(Float)

    grid = relationship("UrbanGridMaster", back_populates="drainage")


class PublicTransport(Base):
    """PUBLIC TRANSPORT group."""

    __tablename__ = "public_transport"

    grid_id = Column(Integer, ForeignKey(FK), primary_key=True)
    bus_stop_count = Column(Float)
    metro_station_count = Column(Float)
    transit_count = Column(Float)

    grid = relationship("UrbanGridMaster", back_populates="public_transport")


class EssentialServices(Base):
    """ESSENTIAL SERVICES group."""

    __tablename__ = "essential_services"

    grid_id = Column(Integer, ForeignKey(FK), primary_key=True)
    hospital_count = Column(Float)
    school_count = Column(Float)
    pharmacy_count = Column(Float)
    police_count = Column(Float)
    public_toilet_count = Column(Float)

    grid = relationship("UrbanGridMaster", back_populates="essential_services")


class Commercial(Base):
    """COMMERCIAL group."""

    __tablename__ = "commercial"

    grid_id = Column(Integer, ForeignKey(FK), primary_key=True)
    commercial_area_km2 = Column(Float)
    industrial_area_km2 = Column(Float)
    retail_area_km2 = Column(Float)

    grid = relationship("UrbanGridMaster", back_populates="commercial")