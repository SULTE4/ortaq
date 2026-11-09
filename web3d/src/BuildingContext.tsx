import { createContext, useContext } from 'react';
import { modelFor, sauran } from './buildingModel';
export const BuildingContext = createContext(modelFor(sauran));
export const useBuildingModel = () => useContext(BuildingContext);
