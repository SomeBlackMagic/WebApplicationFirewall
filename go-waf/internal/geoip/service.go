package geoip

import (
	"net"
	"os"
	"path/filepath"

	"github.com/oschwald/maxminddb-golang"
)

type Service struct {
	countryDB *maxminddb.Reader
	cityDB    *maxminddb.Reader
}

type countryRecord struct {
	Country struct {
		ISOCode string `maxminddb:"iso_code"`
	} `maxminddb:"country"`
}

type cityRecord struct {
	City struct {
		Names map[string]string `maxminddb:"names"`
	} `maxminddb:"city"`
}

func NewService() (*Service, error) {
	cwd, _ := os.Getwd()
	countryPath := filepath.Join(cwd, "GeoIP2-Country.mmdb")
	cityPath := filepath.Join(cwd, "GeoIP2-City.mmdb")

	countryDB, err := maxminddb.Open(countryPath)
	if err != nil {
		return nil, err
	}

	cityDB, err := maxminddb.Open(cityPath)
	if err != nil {
		countryDB.Close()
		return nil, err
	}

	return &Service{countryDB: countryDB, cityDB: cityDB}, nil
}

func (s *Service) GetCountry(ip string) string {
	ip = normalizeIP(ip)
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return "not-detected"
	}

	var record countryRecord
	err := s.countryDB.Lookup(parsed, &record)
	if err != nil || record.Country.ISOCode == "" {
		return "not-detected"
	}
	return record.Country.ISOCode
}

func (s *Service) GetCity(ip string) string {
	ip = normalizeIP(ip)
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return "not-detected"
	}

	var record cityRecord
	err := s.cityDB.Lookup(parsed, &record)
	if err != nil {
		return "not-detected"
	}
	name, ok := record.City.Names["en"]
	if !ok || name == "" {
		return "not-detected"
	}
	return name
}

func (s *Service) Close() {
	if s.countryDB != nil {
		s.countryDB.Close()
	}
	if s.cityDB != nil {
		s.cityDB.Close()
	}
}

func normalizeIP(ip string) string {
	if ip == "::1" {
		return "1.1.1.1"
	}
	return ip
}
